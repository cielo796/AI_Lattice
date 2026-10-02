import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/server/admin/rbac";
import { recordAuditLog } from "@/server/audit/service";
import { getPrismaClient } from "@/server/db/prisma";
import { ServiceError } from "@/server/errors/service-error";
import { validateWorkflowGraph } from "@/lib/workflow-graph";
import type { WorkflowDefinition, WorkflowScheduleInfo } from "@/types/workflow";
import type { User } from "@/types/user";
import { enqueueWorkflowsForRecord, getWorkflowForApp } from "./service";

const BATCH_RECORD_LIMIT = 10;
const MAX_BATCHES = 50;
const FAILURE_DELAY_MS = 300000;

export interface ScheduleRunResult {
  workflowCount: number;
  batchCount: number;
  recordCount: number;
  queuedRunCount: number;
  completedCycleCount: number;
  runIds: string[];
  failures: Array<{ workflowId: string | null; message: string; backoffPersisted: boolean }>;
}

type ScheduleAttempt = {
  workflowId: string;
  tenantId: string;
  workflowUpdatedAt: Date;
  stateRevision: number | null;
  definitionHash: string;
  actor: { id: string; tenantId: string; name: string; email: string };
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function compare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => compare(left, right)).map(([key, content]) => [key, canonical(content)]));
  return value;
}

export function scheduledDefinitionHash(value: Prisma.JsonValue) {
  const definition = object(value);
  const nodes = Array.isArray(definition.nodes) ? definition.nodes.map((node) => {
    const candidate = object(node);
    const data = object(candidate.data);
    return { id: candidate.id, nodeType: data.nodeType, config: data.config };
  }) : definition.nodes;
  const edges = Array.isArray(definition.edges) ? definition.edges.map((edge) => {
    const candidate = object(edge);
    return { source: candidate.source, target: candidate.target, label: candidate.label, sourceHandle: candidate.sourceHandle };
  }) : definition.edges;
  const sort = (items: unknown) => Array.isArray(items) ? items.map(canonical).sort((left, right) => compare(JSON.stringify(left), JSON.stringify(right))) : items;
  return createHash("sha256").update(JSON.stringify({ nodes: sort(nodes), edges: canonical(edges) })).digest("hex");
}

export function scheduleRecordLimit(value = 100) {
  if (!Number.isInteger(value) || value < 1 || value > 500) throw new ServiceError("limitは1〜500の整数で指定してください。", 400);
  return value;
}

export function scheduledTriggerConfiguration(value: Prisma.JsonValue) {
  const definition = object(value);
  if (!Array.isArray(definition.nodes) || !Array.isArray(definition.edges)) throw new ServiceError("スケジュールのグラフ定義が不正です。", 422);
  const errors = validateWorkflowGraph(value as unknown as WorkflowDefinition, { active: true, legacy: true, triggerType: "schedule" });
  if (errors.length) throw new ServiceError(errors.join("\n"), 422);
  const trigger = definition.nodes.find((node) => object(object(node).data).nodeType === "trigger");
  const config = object(object(object(trigger).data).config);
  const intervalMinutes = config.scheduleIntervalMinutes ?? 60;
  if (!Number.isInteger(intervalMinutes) || Number(intervalMinutes) < 1 || Number(intervalMinutes) > 10080) throw new ServiceError("スケジュール間隔は1〜10080分の整数で指定してください。", 422);
  return { intervalMinutes: Number(intervalMinutes), tableId: typeof config.tableId === "string" ? config.tableId : undefined, tableCode: typeof config.tableCode === "string" ? config.tableCode : undefined };
}

function recordTitle(record: { id: string; dataJson: Prisma.JsonValue }) {
  const data = object(record.dataJson);
  for (const key of ["title", "subject", "name", "ticket_id"]) if (typeof data[key] === "string" && data[key].trim()) return data[key].trim();
  return record.id;
}

async function enqueueScheduleBatch(limit: number, excludedIds: string[], onAttempt: (attempt: ScheduleAttempt) => void) {
  return getPrismaClient().$transaction(async (transaction) => {
    const excluded = excludedIds.length ? Prisma.sql`AND workflows.id NOT IN (${Prisma.join(excludedIds)})` : Prisma.empty;
    const [candidate] = await transaction.$queryRaw<Array<{ id: string; now: Date }>>(Prisma.sql`
      SELECT workflows.id, clock_timestamp() AS now FROM workflows
      JOIN apps ON apps.id = workflows.app_id AND apps.tenant_id = workflows.tenant_id AND apps.status <> 'archived'
      JOIN tenants ON tenants.id = workflows.tenant_id AND tenants.status = 'active'
      JOIN users ON users.id = workflows.created_by_id AND users.tenant_id = workflows.tenant_id AND users.status = 'active'
      LEFT JOIN workflow_schedule_states AS schedules ON schedules.workflow_id = workflows.id
      WHERE workflows.status = 'active' AND workflows.trigger_type = 'schedule'
        AND (schedules.workflow_id IS NULL OR schedules.next_due_at <= NOW() OR schedules.workflow_updated_at <> workflows.updated_at)
        ${excluded}
      ORDER BY schedules.last_batch_at ASC NULLS FIRST, workflows.created_at, workflows.id
      LIMIT 1 FOR UPDATE OF workflows SKIP LOCKED`);
    if (!candidate) return null;
    const workflow = await transaction.workflow.findUniqueOrThrow({ where: { id: candidate.id }, include: { app: true, createdBy: true } });
    const previous = await transaction.workflowScheduleState.findUnique({ where: { workflowId: workflow.id } });
    const definitionHash = scheduledDefinitionHash(workflow.definitionJson);
    onAttempt({ workflowId: workflow.id, tenantId: workflow.tenantId, workflowUpdatedAt: workflow.updatedAt, stateRevision: previous?.revision ?? null, definitionHash, actor: workflow.createdBy });
    const changed = previous?.definitionHash !== definitionHash;
    if (previous && !changed && previous.nextDueAt > candidate.now) {
      await transaction.workflowScheduleState.update({ where: { workflowId: workflow.id }, data: { workflowUpdatedAt: workflow.updatedAt, revision: { increment: 1 } } });
      return { workflowId: workflow.id, recordCount: 0, runIds: [] as string[], completed: false };
    }
    const config = scheduledTriggerConfiguration(workflow.definitionJson);
    const cycleId = !changed && previous?.cycleId ? previous.cycleId : randomUUID();
    const cycleStartedAt = !changed && previous?.cycleStartedAt ? previous.cycleStartedAt : candidate.now;
    const cursor = !changed && previous?.cycleId ? previous.cursorRecordId : null;
    const actor = { ...workflow.createdBy, avatarUrl: workflow.createdBy.avatarUrl ?? undefined, createdAt: workflow.createdBy.createdAt.toISOString(), lastLoginAt: workflow.createdBy.lastLoginAt?.toISOString() };
    await requirePermission(actor, "workflow:manage", { appId: workflow.appId });
    if ((config.tableId || config.tableCode) && !await transaction.appTable.count({ where: { tenantId: workflow.tenantId, appId: workflow.appId, ...(config.tableId ? { id: config.tableId } : {}), ...(config.tableCode ? { code: config.tableCode } : {}) } })) throw new ServiceError("スケジュールの対象テーブルがこのアプリに存在しません。", 422);
    const records = await transaction.appRecord.findMany({
      where: { tenantId: workflow.tenantId, appId: workflow.appId, deletedAt: null, createdAt: { lte: cycleStartedAt }, ...(cursor ? { id: { gt: cursor } } : {}), table: { tenantId: workflow.tenantId, appId: workflow.appId, ...(config.tableId ? { id: config.tableId } : {}), ...(config.tableCode ? { code: config.tableCode } : {}) } },
      include: { table: { select: { id: true, code: true, name: true } } }, orderBy: { id: "asc" }, take: limit + 1,
    });
    const batch = records.slice(0, limit);
    const runIds: string[] = [];
    const checkedTables = new Set<string>();
    for (const record of batch) {
      if (!checkedTables.has(record.tableId)) {
        await requirePermission(actor, "record:write", { appId: workflow.appId, tableId: record.tableId });
        checkedTables.add(record.tableId);
      }
      runIds.push(...await enqueueWorkflowsForRecord(actor, {
        appId: workflow.appId, appCode: workflow.app.code, tableId: record.tableId, tableCode: record.table.code, tableName: record.table.name,
        recordId: record.id, recordTitle: recordTitle(record), triggerTypes: ["schedule"], workflowIds: [workflow.id], eventKey: `schedule:${cycleId}:${record.id}`,
      }, transaction));
    }
    const completed = records.length <= limit;
    const [clock] = await transaction.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
    const state = {
      tenantId: workflow.tenantId, definitionHash, workflowUpdatedAt: workflow.updatedAt,
      cycleId: completed ? null : cycleId, cycleStartedAt: completed ? null : cycleStartedAt,
      cursorRecordId: completed ? null : batch.at(-1)!.id,
      nextDueAt: completed ? new Date(clock.now.getTime() + config.intervalMinutes * 60000) : clock.now,
      lastBatchAt: clock.now, lastError: null,
    };
    await transaction.workflowScheduleState.upsert({ where: { workflowId: workflow.id }, create: { workflowId: workflow.id, ...state, revision: 1 }, update: { ...state, revision: { increment: 1 } } });
    await recordAuditLog(actor, { actionType: "WORKFLOW_SCHEDULE_BATCH", resourceType: "workflow", resourceId: workflow.id, resourceName: workflow.name, detailJson: { cycleId, recordCount: batch.length, runIds, completed, intervalMinutes: config.intervalMinutes, nextDueAt: state.nextDueAt.toISOString() } }, transaction);
    return { workflowId: workflow.id, recordCount: batch.length, runIds, completed };
  }, { timeout: 30000, maxWait: 10000 });
}

async function deferFailedSchedule(attempt: ScheduleAttempt, message: string) {
  return getPrismaClient().$transaction(async (transaction) => {
    const [locked] = await transaction.$queryRaw<Array<{ id: string; now: Date }>>`SELECT id, clock_timestamp() AS now FROM workflows WHERE id = ${attempt.workflowId} AND tenant_id = ${attempt.tenantId} AND status = 'active' AND trigger_type = 'schedule' FOR UPDATE SKIP LOCKED`;
    if (!locked) return false;
    const workflow = await transaction.workflow.findUniqueOrThrow({ where: { id: locked.id } });
    const previous = await transaction.workflowScheduleState.findUnique({ where: { workflowId: locked.id } });
    if (workflow.updatedAt.getTime() !== attempt.workflowUpdatedAt.getTime() || (previous?.revision ?? null) !== attempt.stateRevision) return false;
    const backoff = {
      lastError: message.slice(0, 1000), lastBatchAt: locked.now, nextDueAt: new Date(locked.now.getTime() + FAILURE_DELAY_MS),
      workflowUpdatedAt: workflow.updatedAt, definitionHash: attempt.definitionHash,
      ...(previous && previous.definitionHash !== attempt.definitionHash ? { cycleId: null, cycleStartedAt: null, cursorRecordId: null } : {}),
    };
    await transaction.workflowScheduleState.upsert({ where: { workflowId: locked.id }, create: { workflowId: locked.id, tenantId: attempt.tenantId, ...backoff, revision: 1 }, update: { ...backoff, revision: { increment: 1 } } });
    await recordAuditLog(attempt.actor, { actionType: "WORKFLOW_SCHEDULE_FAILED", resourceType: "workflow", resourceId: locked.id, result: "error", detailJson: { message: backoff.lastError, retryAfter: backoff.nextDueAt.toISOString() } }, transaction);
    return true;
  }, { timeout: 10000, maxWait: 10000 });
}

export async function runDueScheduledWorkflows(limit = 100): Promise<ScheduleRunResult> {
  const recordLimit = scheduleRecordLimit(limit);
  const result: ScheduleRunResult = { workflowCount: 0, batchCount: 0, recordCount: 0, queuedRunCount: 0, completedCycleCount: 0, runIds: [], failures: [] };
  const visited = new Set<string>();
  const excluded: string[] = [];
  const deadline = Date.now() + 45000;
  while (result.recordCount < recordLimit && result.batchCount < MAX_BATCHES && Date.now() < deadline) {
    let attempt: ScheduleAttempt | undefined;
    result.batchCount += 1;
    try {
      const batch = await enqueueScheduleBatch(Math.min(BATCH_RECORD_LIMIT, recordLimit - result.recordCount), excluded, (selected) => { attempt = selected; });
      if (!batch) { result.batchCount -= 1; break; }
      visited.add(batch.workflowId);
      result.recordCount += batch.recordCount;
      result.runIds.push(...batch.runIds);
      result.completedCycleCount += Number(batch.completed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      let backoffPersisted = false;
      if (attempt) {
        visited.add(attempt.workflowId);
        excluded.push(attempt.workflowId);
        try { backoffPersisted = await deferFailedSchedule(attempt, message); } catch { }
      }
      result.failures.push({ workflowId: attempt?.workflowId ?? null, message, backoffPersisted });
      if (!attempt) break;
    }
  }
  result.workflowCount = visited.size;
  result.queuedRunCount = result.runIds.length;
  return result;
}

export async function getWorkflowScheduleForApp(user: User, appId: string, workflowId: string): Promise<WorkflowScheduleInfo> {
  const workflow = await getWorkflowForApp(user, appId, workflowId);
  if (workflow.triggerType !== "schedule") throw new ServiceError("スケジュールワークフローではありません。", 400);
  const state = await getPrismaClient().workflowScheduleState.findFirst({ where: { workflowId, tenantId: user.tenantId } });
  return { workflowStatus: workflow.status, nextDueAt: state?.nextDueAt.toISOString() ?? null, cycleInProgress: !!state?.cycleId, lastBatchAt: state?.lastBatchAt?.toISOString() ?? null, lastError: state?.lastError ?? null };
}

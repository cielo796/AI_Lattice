import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/server/db/prisma";
import { runApprovalWorkflowsForRecord } from "@/server/workflows/service";
import type { User } from "@/types/user";

const DEFAULT_RECORD_LIMIT = 100;
const MAX_RECORD_LIMIT = 500;

export interface ScheduleRunResult {
  workflowCount: number;
  recordCount: number;
  approvalCount: number;
  failures: Array<{ workflowId: string; recordId: string; message: string }>;
}

function toActor(user: {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: "active" | "inactive";
  lastLoginAt: Date | null;
  createdAt: Date;
}): User {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? undefined,
    status: user.status,
    lastLoginAt: user.lastLoginAt?.toISOString(),
    createdAt: user.createdAt.toISOString(),
  };
}

function getTriggerScope(definition: Prisma.JsonValue) {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    return {};
  }

  const nodes = Array.isArray(definition.nodes) ? definition.nodes : [];
  for (const node of nodes) {
    if (!node || typeof node !== "object" || Array.isArray(node)) continue;
    const data = node.data;
    if (!data || typeof data !== "object" || Array.isArray(data) || data.nodeType !== "trigger") continue;
    const config = data.config;
    if (!config || typeof config !== "object" || Array.isArray(config)) return {};
    return {
      tableId: typeof config.tableId === "string" ? config.tableId : undefined,
      tableCode: typeof config.tableCode === "string" ? config.tableCode : undefined,
    };
  }

  return {};
}

function getRecordTitle(record: { id: string; dataJson: Prisma.JsonValue }) {
  if (record.dataJson && typeof record.dataJson === "object" && !Array.isArray(record.dataJson)) {
    for (const key of ["title", "subject", "name", "ticket_id"]) {
      const value = record.dataJson[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return record.id;
}

export async function runDueScheduledWorkflows(limit = DEFAULT_RECORD_LIMIT): Promise<ScheduleRunResult> {
  const recordLimit = Number.isInteger(limit)
    ? Math.max(1, Math.min(limit, MAX_RECORD_LIMIT))
    : DEFAULT_RECORD_LIMIT;
  const prisma = getPrismaClient();
  const workflows = await prisma.workflow.findMany({
    where: { status: "active", triggerType: "schedule" },
    include: { app: true, createdBy: true },
    orderBy: [{ updatedAt: "asc" }, { createdAt: "asc" }],
  });
  const result: ScheduleRunResult = {
    workflowCount: workflows.length,
    recordCount: 0,
    approvalCount: 0,
    failures: [],
  };

  for (const workflow of workflows) {
    const actor = toActor(workflow.createdBy);
    const scope = getTriggerScope(workflow.definitionJson);
    const tables = await prisma.appTable.findMany({
      where: {
        tenantId: workflow.tenantId,
        appId: workflow.appId,
        ...(scope.tableId ? { id: scope.tableId } : {}),
        ...(scope.tableCode ? { code: scope.tableCode } : {}),
      },
      orderBy: { sortOrder: "asc" },
    });

    for (const table of tables) {
      const remaining = recordLimit - result.recordCount;
      if (remaining <= 0) return result;

      const records = await prisma.appRecord.findMany({
        where: {
          tenantId: workflow.tenantId,
          appId: workflow.appId,
          tableId: table.id,
          deletedAt: null,
        },
        select: { id: true, dataJson: true },
        orderBy: { updatedAt: "asc" },
        take: remaining,
      });

      for (const record of records) {
        try {
          const approvals = await runApprovalWorkflowsForRecord(actor, {
            appId: workflow.appId,
            appCode: workflow.app.code,
            tableId: table.id,
            tableCode: table.code,
            tableName: table.name,
            recordId: record.id,
            recordTitle: getRecordTitle(record),
            triggerTypes: ["schedule"],
            workflowIds: [workflow.id],
          });
          result.recordCount += 1;
          result.approvalCount += approvals.length;
        } catch (error) {
          result.recordCount += 1;
          result.failures.push({
            workflowId: workflow.id,
            recordId: record.id,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  return result;
}

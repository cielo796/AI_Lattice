import { Prisma, type WorkflowRun as StoredWorkflowRun } from "@prisma/client";
import { requirePermission } from "@/server/admin/rbac";
import { recordAuditLog } from "@/server/audit/service";
import { getPrismaClient } from "@/server/db/prisma";
import { workflowNextNodeIds } from "@/lib/workflow-graph";
import type { WorkflowDefinition, WorkflowRecoveryInput, WorkflowRun, WorkflowRunState } from "@/types/workflow";
import type { User } from "@/types/user";
import type { RunApprovalWorkflowInput } from "./service";
import { ServiceError } from "@/server/errors/service-error";

export const WORKFLOW_LEASE_MS = 300000;

class WorkflowLeaseLostError extends Error {}

export class WorkflowUncertainOutcomeError extends Error {}

async function extendWorkflowLease(transaction: Prisma.TransactionClient, runId: string, tenantId: string, leaseToken: string) {
  const renewed = await transaction.$executeRaw`UPDATE workflow_runs SET lease_expires_at = clock_timestamp() + INTERVAL '5 minutes' WHERE id = ${runId} AND tenant_id = ${tenantId} AND status = 'running' AND lease_token = ${leaseToken}`;
  if (renewed !== 1) throw new WorkflowLeaseLostError("実行権を失いました。");
}

export function expiredRunRecovery(state: WorkflowRunState, definition: WorkflowDefinition) {
  const next = structuredClone(state);
  const unfinished = next.executions.filter((step) => step.status === "running");
  if (unfinished.length === 0) return { status: "ready", state: next, error: null };
  const step = unfinished[0];
  const node = definition.nodes.find((item) => item.id === step.nodeId);
  if (unfinished.length !== 1 || !node || !["trigger", "condition", "approval", "notification", "status_update"].includes(node.data.nodeType)) {
    return { status: "interrupted", state: next, error: "外部処理の結果を確認できないため停止しました。実行先を確認し、管理者が再試行・処理済み・失敗を判断してください。" };
  }
  next.executions = next.executions.filter((item) => item.nodeId !== step.nodeId);
  next.queue = [step.nodeId, ...next.queue.filter((nodeId) => nodeId !== step.nodeId)];
  return { status: "ready", state: next, error: null };
}

export type WorkflowNodeExecutor = (
  actor: User,
  input: RunApprovalWorkflowInput,
  workflow: { id: string; name: string; runId: string; sourceWorkflowId: string | null },
  node: WorkflowDefinition["nodes"][number],
  transaction: Prisma.TransactionClient
) => Promise<{ outcome?: string; approvalId?: string } | void>;

export function workflowJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function toWorkflowRun(run: StoredWorkflowRun): WorkflowRun {
  return {
    id: run.id,
    workflowId: run.workflowId,
    workflowName: run.workflowName,
    recordId: run.recordId,
    status: run.status as WorkflowRun["status"],
    state: run.stateJson as unknown as WorkflowRunState,
    error: run.error,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}

export async function executeSavedWorkflowRun(user: Pick<User, "tenantId">, runId: string, executeNode: WorkflowNodeExecutor) {
  const deadline = Date.now() + 45000;
  const prisma = getPrismaClient();
  const run = await prisma.workflowRun.findFirst({
    where: { id: runId, tenantId: user.tenantId },
    include: { actor: true, tenant: true, record: true },
  });
  if (!run || !["ready", "waiting"].includes(run.status)) return;
  const state = structuredClone(run.stateJson) as unknown as WorkflowRunState;
  const definition = run.definitionJson as unknown as WorkflowDefinition;
  const input = run.contextJson as unknown as RunApprovalWorkflowInput;
  let decision: string | undefined;
  if (state.waitingFor) {
    const approval = await prisma.approval.findFirst({
      where: { id: state.waitingFor.approvalId, tenantId: run.tenantId, workflowRunId: run.id, workflowNodeId: state.waitingFor.nodeId },
    });
    if (!approval || approval.status === "pending") return;
    decision = approval.status;
  }
  const leaseToken = crypto.randomUUID();
  const claim = await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.workflowRun.updateMany({
      where: { id: run.id, tenantId: run.tenantId, status: run.status, updatedAt: run.updatedAt },
      data: { status: "running", leaseToken, leaseExpiresAt: null },
    });
    if (claimed.count === 1) await extendWorkflowLease(transaction, run.id, run.tenantId, leaseToken);
    return claimed;
  });
  if (claim.count !== 1) return;
  async function lockLease(transaction: Prisma.TransactionClient) {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`SELECT id FROM workflow_runs WHERE id = ${run!.id} AND tenant_id = ${run!.tenantId} AND status = 'running' AND lease_token = ${leaseToken} AND lease_expires_at > NOW() FOR UPDATE`;
    if (locked.length !== 1) throw new WorkflowLeaseLostError("実行権を失いました。");
  }
  async function checkpoint(transaction: Prisma.TransactionClient, data: Prisma.WorkflowRunUpdateManyMutationInput) {
    const release = typeof data.status === "string" && data.status !== "running";
    const saved = await transaction.workflowRun.updateMany({
      where: { id: run!.id, tenantId: run!.tenantId, status: "running", leaseToken },
      data: { ...data, leaseToken: release ? null : leaseToken, ...(release ? { leaseExpiresAt: null } : {}) },
    });
    if (saved.count !== 1) throw new WorkflowLeaseLostError("実行権を失いました。");
    if (!release) await extendWorkflowLease(transaction, run!.id, run!.tenantId, leaseToken);
  }
  async function refreshRecordSnapshot(transaction: Prisma.TransactionClient) {
    if (!input.recordSnapshot) return input;
    const record = await transaction.appRecord.findFirst({ where: { id: run!.recordId, tenantId: run!.tenantId, appId: run!.appId, deletedAt: null } });
    if (!record) throw new Error("対象レコードが見つかりません。");
    return { ...input, recordSnapshot: { status: record.status, dataJson: record.dataJson } };
  }
  const actor: User = {
    id: run.actor.id, tenantId: run.actor.tenantId, name: run.actor.name,
    email: run.actor.email, status: run.actor.status, createdAt: run.actor.createdAt.toISOString(),
  };
  try {
    if (actor.status !== "active" || run.tenant.status !== "active" || actor.tenantId !== run.tenantId || run.record.deletedAt) {
      throw new Error("実行ユーザー・組織・対象レコードが無効なため実行を停止しました。");
    }
    await requirePermission(actor, "record:write", { appId: run.appId, tableId: run.record.tableId });
    if (run.status === "ready") await prisma.$transaction(async (transaction) => {
      await lockLease(transaction);
      await recordAuditLog(actor, {
        actionType: "WORKFLOW_RUN", resourceType: "workflow_run", resourceId: run.id,
        resourceName: run.workflowName, detailJson: { workflowId: run.workflowId, recordId: run.recordId },
      }, transaction);
    });
    if (state.waitingFor && decision) {
      const waiting = state.waitingFor;
      const execution = state.executions.find((item) => item.nodeId === waiting.nodeId);
      if (!execution) throw new Error("承認待ちノードの実行記録が見つかりません。");
      execution.status = "success";
      execution.outcome = decision;
      execution.finishedAt = new Date().toISOString();
      state.queue.push(...workflowNextNodeIds(definition, waiting.nodeId, decision));
      delete state.waitingFor;
      const resumedInput = await prisma.$transaction(async (transaction) => {
        await lockLease(transaction);
        const nextInput = await refreshRecordSnapshot(transaction);
        await checkpoint(transaction, { stateJson: workflowJson(state), contextJson: workflowJson(nextInput) });
        await recordAuditLog(actor, {
          actionType: "WORKFLOW_RESUME", resourceType: "workflow_run", resourceId: run.id,
          resourceName: run.workflowName, detailJson: { nodeId: waiting.nodeId, approvalId: waiting.approvalId, decision },
        }, transaction);
        return nextInput;
      });
      Object.assign(input, resumedInput);
    }
    while (state.queue.length) {
      if (Date.now() >= deadline) {
        await prisma.$transaction(async (transaction) => {
          await lockLease(transaction);
          await checkpoint(transaction, { status: "ready", stateJson: workflowJson(state), contextJson: workflowJson(input) });
        });
        return;
      }
      const nodeId = state.queue.shift()!;
      if (state.executions.some((item) => item.nodeId === nodeId)) continue;
      const node = definition.nodes.find((item) => item.id === nodeId);
      if (!node) throw new Error(`実行ノード「${nodeId}」が見つかりません。`);
      const execution = { nodeId, nodeType: node.data.nodeType, status: "running" as const, startedAt: new Date().toISOString() };
      state.executions.push(execution);
      await prisma.$transaction(async (transaction) => {
        await lockLease(transaction);
        await checkpoint(transaction, { stateJson: workflowJson(state) });
      });
      let externalResultReturned = false;
      try {
        const next = await prisma.$transaction(async (transaction) => {
          await lockLease(transaction);
          const result = await executeNode(actor, input, { id: run.workflowId ?? run.id, sourceWorkflowId: run.workflowId, name: run.workflowName, runId: run.id }, node, transaction);
          externalResultReturned = ["api_call", "ai_action"].includes(node.data.nodeType);
          const updated = structuredClone(state);
          const step = updated.executions.at(-1)!;
          step.status = result?.approvalId ? "waiting" : "success";
          step.outcome = result?.outcome;
          step.approvalId = result?.approvalId;
          if (result?.approvalId) updated.waitingFor = { nodeId, approvalId: result.approvalId };
          else {
            step.finishedAt = new Date().toISOString();
            updated.queue.push(...workflowNextNodeIds(definition, nodeId, result?.outcome));
          }
          const nextInput = node.data.nodeType === "status_update" || node.data.nodeType === "approval" || (node.data.nodeType === "ai_action" && node.data.config?.output === "field") ? await refreshRecordSnapshot(transaction) : input;
          await checkpoint(transaction, { stateJson: workflowJson(updated), contextJson: workflowJson(nextInput), status: result?.approvalId ? "waiting" : "running" });
          await recordAuditLog(actor, {
            actionType: "WORKFLOW_NODE_EXECUTE", resourceType: "workflow_run", resourceId: run.id,
            resourceName: run.workflowName, detailJson: { ...step, recordId: run.recordId },
          }, transaction);
          return { state: updated, input: nextInput };
        }, { timeout: 120000 });
        Object.assign(state, next.state);
        Object.assign(input, next.input);
        if (state.waitingFor) return;
      } catch (error) {
        if (error instanceof WorkflowLeaseLostError) throw error;
        if (error instanceof WorkflowUncertainOutcomeError || externalResultReturned) {
          throw new WorkflowUncertainOutcomeError(error instanceof Error ? error.message : String(error));
        }
        const step = state.executions.at(-1)!;
        step.status = "failure";
        step.finishedAt = new Date().toISOString();
        step.error = error instanceof Error ? error.message : String(error);
        if (["trigger", "condition", "approval"].includes(node.data.nodeType) || node.data.config?.required === true || node.data.config?.failurePolicy !== "continue") throw error;
        state.queue.push(...workflowNextNodeIds(definition, nodeId));
        await prisma.$transaction(async (transaction) => {
          await lockLease(transaction);
          await checkpoint(transaction, { stateJson: workflowJson(state) });
          await recordAuditLog(actor, {
            actionType: "WORKFLOW_NODE_EXECUTE", resourceType: "workflow_run", resourceId: run.id,
            resourceName: run.workflowName, result: "error", detailJson: { ...step, failurePolicy: "continue" },
          }, transaction);
        });
      }
    }
    for (const node of definition.nodes) {
      if (!state.executions.some((item) => item.nodeId === node.id)) state.executions.push({
        nodeId: node.id, nodeType: node.data.nodeType, status: "skip", startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
      });
    }
    await prisma.$transaction(async (transaction) => {
      await lockLease(transaction);
      await checkpoint(transaction, { status: "completed", stateJson: workflowJson(state), finishedAt: new Date(), error: null });
      await recordAuditLog(actor, {
        actionType: "WORKFLOW_COMPLETE", resourceType: "workflow_run", resourceId: run.id,
        resourceName: run.workflowName, detailJson: { recordId: run.recordId, nodeCount: state.executions.length },
      }, transaction);
    });
  } catch (error) {
    if (error instanceof WorkflowLeaseLostError) return;
    const message = error instanceof Error ? error.message : String(error);
    await prisma.$transaction(async (transaction) => {
      const interrupted = error instanceof WorkflowUncertainOutcomeError;
      const saved = await transaction.workflowRun.updateMany({
        where: { id: run.id, tenantId: run.tenantId, status: "running", leaseToken },
        data: { status: interrupted ? "interrupted" : "failed", error: message, stateJson: workflowJson(state), finishedAt: interrupted ? null : new Date(), leaseToken: null, leaseExpiresAt: null },
      });
      if (saved.count !== 1) return;
      await recordAuditLog(actor, {
        actionType: interrupted ? "WORKFLOW_INTERRUPTED" : "WORKFLOW_FAILED", resourceType: "workflow_run", resourceId: run.id,
        resourceName: run.workflowName, result: "error", detailJson: { recordId: run.recordId, message },
      }, transaction);
    });
  }
}

export async function recoverInterruptedWorkflowRun(user: User, appId: string, runId: string, input: WorkflowRecoveryInput) {
  await requirePermission(user, "workflow:manage", { appId });
  if (!input || !["retry", "skip", "fail"].includes(input.action) || typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 1000 || typeof input.expectedUpdatedAt !== "string" || Number.isNaN(new Date(input.expectedUpdatedAt).getTime())) throw new ServiceError("復旧操作・理由・実行更新時刻を指定してください。", 400);
  if (input.action !== "fail" && input.confirmExternalOutcome !== true) throw new ServiceError("外部処理の結果と重複実行リスクの確認が必要です。", 400);
  return getPrismaClient().$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`SELECT id FROM workflow_runs WHERE id = ${runId} AND tenant_id = ${user.tenantId} AND app_id = ${appId} FOR UPDATE`;
    if (!locked.length) throw new ServiceError("ワークフロー実行が見つかりません。", 404);
    const run = await transaction.workflowRun.findFirstOrThrow({ where: { id: runId, tenantId: user.tenantId, appId } });
    if (run.status !== "interrupted" || run.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) throw new ServiceError("実行状態が変更されています。履歴を更新してください。", 409);
    const state = structuredClone(run.stateJson) as unknown as WorkflowRunState;
    const definition = run.definitionJson as unknown as WorkflowDefinition;
    const unfinished = state.executions.filter((step) => step.status === "running");
    if (input.action !== "fail" && (unfinished.length !== 1 || !definition.nodes.some((node) => node.id === unfinished[0].nodeId))) throw new ServiceError("実行状態を復旧できません。失敗として終了してください。", 409);
    if (input.action === "retry") {
      state.executions = state.executions.filter((step) => step.nodeId !== unfinished[0].nodeId);
      state.queue = [unfinished[0].nodeId, ...state.queue.filter((nodeId) => nodeId !== unfinished[0].nodeId)];
    } else if (input.action === "skip") {
      unfinished[0].status = "skip";
      unfinished[0].finishedAt = new Date().toISOString();
      unfinished[0].error = `管理者が処理済みと判断: ${input.reason.trim()}`;
      state.queue.push(...workflowNextNodeIds(definition, unfinished[0].nodeId));
    } else for (const step of unfinished) {
      step.status = "failure";
      step.finishedAt = new Date().toISOString();
      step.error = input.reason.trim();
    }
    const context = structuredClone(run.contextJson) as unknown as RunApprovalWorkflowInput;
    if (input.action === "skip" && context.recordSnapshot) {
      const record = await transaction.appRecord.findFirst({ where: { id: run.recordId, tenantId: run.tenantId, appId: run.appId, deletedAt: null } });
      if (record) context.recordSnapshot = { status: record.status, dataJson: record.dataJson };
    }
    const saved = await transaction.workflowRun.update({ where: { id: run.id }, data: {
      status: input.action === "fail" ? "failed" : "ready", stateJson: workflowJson(state), contextJson: workflowJson(context),
      error: input.action === "fail" ? input.reason.trim() : null,
      finishedAt: input.action === "fail" ? new Date() : null, leaseToken: null, leaseExpiresAt: null,
    } });
    await recordAuditLog(user, {
      actionType: "WORKFLOW_RECOVERY_DECISION", resourceType: "workflow_run", resourceId: run.id, resourceName: run.workflowName,
      detailJson: { action: input.action, reason: input.reason.trim(), nodeIds: unfinished.map((step) => step.nodeId), originalActorId: run.actorId, confirmExternalOutcome: input.confirmExternalOutcome === true },
    }, transaction);
    return toWorkflowRun(saved);
  });
}

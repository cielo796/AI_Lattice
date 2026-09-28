import { Prisma, type WorkflowRun as StoredWorkflowRun } from "@prisma/client";
import { requirePermission } from "@/server/admin/rbac";
import { recordAuditLog } from "@/server/audit/service";
import { getPrismaClient } from "@/server/db/prisma";
import { workflowNextNodeIds } from "@/lib/workflow-graph";
import type { WorkflowDefinition, WorkflowRun, WorkflowRunState } from "@/types/workflow";
import type { User } from "@/types/user";
import type { RunApprovalWorkflowInput } from "./service";

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
  const claim = await prisma.workflowRun.updateMany({
    where: { id: run.id, tenantId: run.tenantId, status: run.status, updatedAt: run.updatedAt },
    data: { status: "running" },
  });
  if (claim.count !== 1) return;
  const actor: User = {
    id: run.actor.id, tenantId: run.actor.tenantId, name: run.actor.name,
    email: run.actor.email, status: run.actor.status, createdAt: run.actor.createdAt.toISOString(),
  };
  try {
    if (actor.status !== "active" || run.tenant.status !== "active" || actor.tenantId !== run.tenantId || run.record.deletedAt) {
      throw new Error("実行ユーザー・組織・対象レコードが無効なため実行を停止しました。");
    }
    await requirePermission(actor, "record:write", { appId: run.appId, tableId: run.record.tableId });
    if (run.status === "ready") await recordAuditLog(actor, {
      actionType: "WORKFLOW_RUN", resourceType: "workflow_run", resourceId: run.id,
      resourceName: run.workflowName, detailJson: { workflowId: run.workflowId, recordId: run.recordId },
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
      await prisma.$transaction(async (transaction) => {
        await transaction.workflowRun.update({ where: { id: run.id }, data: { stateJson: workflowJson(state) } });
        await recordAuditLog(actor, {
          actionType: "WORKFLOW_RESUME", resourceType: "workflow_run", resourceId: run.id,
          resourceName: run.workflowName, detailJson: { nodeId: waiting.nodeId, approvalId: waiting.approvalId, decision },
        }, transaction);
      });
    }
    while (state.queue.length) {
      const nodeId = state.queue.shift()!;
      if (state.executions.some((item) => item.nodeId === nodeId)) continue;
      const node = definition.nodes.find((item) => item.id === nodeId);
      if (!node) throw new Error(`実行ノード「${nodeId}」が見つかりません。`);
      const execution = { nodeId, nodeType: node.data.nodeType, status: "running" as const, startedAt: new Date().toISOString() };
      state.executions.push(execution);
      await prisma.workflowRun.update({ where: { id: run.id }, data: { stateJson: workflowJson(state) } });
      try {
        const next = await prisma.$transaction(async (transaction) => {
          const result = await executeNode(actor, input, { id: run.workflowId ?? run.id, sourceWorkflowId: run.workflowId, name: run.workflowName, runId: run.id }, node, transaction);
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
          await transaction.workflowRun.update({
            where: { id: run.id },
            data: { stateJson: workflowJson(updated), status: result?.approvalId ? "waiting" : "running" },
          });
          await recordAuditLog(actor, {
            actionType: "WORKFLOW_NODE_EXECUTE", resourceType: "workflow_run", resourceId: run.id,
            resourceName: run.workflowName, detailJson: { ...step, recordId: run.recordId },
          }, transaction);
          return updated;
        }, { timeout: 120000 });
        Object.assign(state, next);
        if (state.waitingFor) return;
      } catch (error) {
        const step = state.executions.at(-1)!;
        step.status = "failure";
        step.finishedAt = new Date().toISOString();
        step.error = error instanceof Error ? error.message : String(error);
        if (["trigger", "condition", "approval"].includes(node.data.nodeType) || node.data.config?.required === true || node.data.config?.failurePolicy !== "continue") throw error;
        state.queue.push(...workflowNextNodeIds(definition, nodeId));
        await prisma.$transaction(async (transaction) => {
          await transaction.workflowRun.update({ where: { id: run.id }, data: { stateJson: workflowJson(state) } });
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
      await transaction.workflowRun.update({ where: { id: run.id }, data: { status: "completed", stateJson: workflowJson(state), finishedAt: new Date() } });
      await recordAuditLog(actor, {
        actionType: "WORKFLOW_COMPLETE", resourceType: "workflow_run", resourceId: run.id,
        resourceName: run.workflowName, detailJson: { recordId: run.recordId, nodeCount: state.executions.length },
      }, transaction);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.$transaction(async (transaction) => {
      await transaction.workflowRun.update({ where: { id: run.id }, data: { status: "failed", error: message, stateJson: workflowJson(state), finishedAt: new Date() } });
      await recordAuditLog(actor, {
        actionType: "WORKFLOW_FAILED", resourceType: "workflow_run", resourceId: run.id,
        resourceName: run.workflowName, result: "error", detailJson: { recordId: run.recordId, message },
      }, transaction);
    });
  }
}

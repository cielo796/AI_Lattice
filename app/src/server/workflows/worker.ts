import { getPrismaClient } from "@/server/db/prisma";
import { recordAuditLog } from "@/server/audit/service";
import { ServiceError } from "@/server/errors/service-error";
import type { WorkflowDefinition, WorkflowRunState } from "@/types/workflow";
import { expiredRunRecovery, WORKFLOW_LEASE_MS, workflowJson } from "./execution";
import { dispatchWorkflowRunIds } from "./service";

export function workflowBatchLimit(value: number | undefined = 10) {
  if (!Number.isInteger(value) || value < 1 || value > 50) throw new ServiceError("limitは1〜50の整数で指定してください。", 400);
  return value;
}

export async function recoverExpiredWorkflowRuns(limit = 10) {
  const batch = workflowBatchLimit(limit);
  const cutoff = new Date(Date.now() - WORKFLOW_LEASE_MS);
  return getPrismaClient().$transaction(async (transaction) => {
    const candidates = await transaction.$queryRaw<Array<{ id: string }>>`SELECT id FROM workflow_runs WHERE status = 'running' AND ((lease_expires_at IS NOT NULL AND lease_expires_at <= NOW()) OR (lease_expires_at IS NULL AND updated_at <= ${cutoff})) ORDER BY updated_at, id LIMIT ${batch} FOR UPDATE SKIP LOCKED`;
    const recovered: Array<{ id: string; status: string }> = [];
    for (const candidate of candidates) {
      const run = await transaction.workflowRun.findUniqueOrThrow({ where: { id: candidate.id }, include: { actor: true } });
      const next = expiredRunRecovery(run.stateJson as unknown as WorkflowRunState, run.definitionJson as unknown as WorkflowDefinition);
      await transaction.workflowRun.update({ where: { id: run.id }, data: {
        status: next.status, stateJson: workflowJson(next.state), error: next.error, leaseToken: null, leaseExpiresAt: null, finishedAt: null,
      } });
      await recordAuditLog(run.actor, {
        actionType: next.status === "ready" ? "WORKFLOW_LEASE_RECOVERED" : "WORKFLOW_INTERRUPTED",
        resourceType: "workflow_run", resourceId: run.id, resourceName: run.workflowName,
        result: next.status === "ready" ? "success" : "error",
        detailJson: { previousLeaseToken: run.leaseToken, status: next.status, recordId: run.recordId },
      }, transaction);
      recovered.push({ id: run.id, status: next.status });
    }
    return recovered;
  }, { timeout: 30000, maxWait: 10000 });
}

export async function dispatchPendingWorkflowRuns(limit = 10) {
  const batch = workflowBatchLimit(limit);
  const recovered = await recoverExpiredWorkflowRuns(batch);
  const prisma = getPrismaClient();
  const candidates = await prisma.$queryRaw<Array<{ id: string; tenant_id: string }>>`
    SELECT runs.id, runs.tenant_id FROM workflow_runs AS runs
    WHERE runs.status = 'ready' OR (runs.status = 'waiting' AND EXISTS (
      SELECT 1 FROM approvals AS approval WHERE approval.id = runs.state_json->'waitingFor'->>'approvalId'
      AND approval.tenant_id = runs.tenant_id AND approval.workflow_run_id = runs.id
      AND approval.workflow_node_id = runs.state_json->'waitingFor'->>'nodeId' AND approval.status <> 'pending'
    )) ORDER BY runs.created_at, runs.id LIMIT ${batch}`;
  const processed: Array<{ id: string; status: string }> = [];
  const failures: Array<{ id: string; message: string }> = [];
  const deadline = Date.now() + 45000;
  for (const run of candidates) {
    if (Date.now() >= deadline) break;
    try {
      await dispatchWorkflowRunIds({ tenantId: run.tenant_id }, [run.id]);
      const current = await prisma.workflowRun.findUniqueOrThrow({ where: { id: run.id } });
      processed.push({ id: run.id, status: current.status });
    } catch (error) {
      failures.push({ id: run.id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { recovered, processed, failures };
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeSavedWorkflowRun, expiredRunRecovery, WorkflowUncertainOutcomeError, type WorkflowNodeExecutor } from "./execution";
import type { WorkflowDefinition, WorkflowRunState } from "@/types/workflow";

const { getPrismaClient, requirePermission, recordAuditLog } = vi.hoisted(() => ({
  getPrismaClient: vi.fn(), requirePermission: vi.fn(), recordAuditLog: vi.fn(),
}));
vi.mock("@/server/db/prisma", () => ({ getPrismaClient }));
vi.mock("@/server/admin/rbac", () => ({ requirePermission }));
vi.mock("@/server/audit/service", () => ({ recordAuditLog }));

const definition: WorkflowDefinition = {
  nodes: [
    { id: "notify", data: { nodeType: "notification", label: "After decision" } },
    { id: "approval", data: { nodeType: "approval", label: "Gate" } },
    { id: "start", data: { nodeType: "trigger", label: "Start" } },
  ],
  edges: [{ id: "01", source: "start", target: "approval" }, { id: "02", source: "approval", target: "notify", label: "approved" }],
};

function fixture() {
  const run = {
    id: "run", tenantId: "tenant", appId: "app", recordId: "record", workflowId: "workflow", workflowName: "Workflow",
    status: "ready", definitionJson: definition, contextJson: { appId: "app", tableId: "table", recordId: "record" },
    stateJson: { queue: ["start"], executions: [] } as WorkflowRunState,
    actor: { id: "actor", tenantId: "tenant", name: "Actor", email: "actor@example.com", status: "active", createdAt: new Date() },
    tenant: { status: "active" }, record: { tableId: "table", deletedAt: null }, updatedAt: new Date(), error: null as string | null,
    leaseToken: null as string | null, leaseExpiresAt: null as Date | null,
  };
  const approval = { id: "approval", status: "pending" };
  const prisma = {
    workflowRun: {
      findFirst: vi.fn(async ({ where }) => where.tenantId === run.tenantId ? structuredClone(run) : null),
      updateMany: vi.fn(async ({ where, data }) => {
        if (where.status !== run.status) return { count: 0 };
        if (where.leaseToken && where.leaseToken !== run.leaseToken) return { count: 0 };
        Object.assign(run, data);
        return { count: 1 };
      }),
      update: vi.fn(async ({ data }) => Object.assign(run, data)),
    },
    approval: { findFirst: vi.fn(async () => approval) },
    appRecord: { findFirst: vi.fn(async () => ({ status: "current", dataJson: {} })) },
    $queryRaw: vi.fn(async (_query, runId, tenantId, leaseToken) => runId === run.id && tenantId === run.tenantId && leaseToken === run.leaseToken && run.status === "running" ? [{ id: run.id }] : []),
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (action) => action(prisma));
  getPrismaClient.mockReturnValue(prisma);
  const execute = vi.fn<WorkflowNodeExecutor>(async (_actor, _input, _workflow, node) => node.id === "approval" ? { approvalId: "approval" } : undefined);
  return { run, approval, execute, prisma };
}

describe("durable workflow execution", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); requirePermission.mockResolvedValue(undefined); });

  it("persists the approval gate and resumes once despite competing workers", async () => {
    const { run, approval, execute } = fixture();
    await Promise.all([executeSavedWorkflowRun({ tenantId: "tenant" }, "run", execute), executeSavedWorkflowRun({ tenantId: "tenant" }, "run", execute)]);
    expect(run.status).toBe("waiting");
    expect(execute.mock.calls.map((call) => call[3].id)).toEqual(["start", "approval"]);
    await executeSavedWorkflowRun({ tenantId: "tenant" }, "run", execute);
    expect(execute).toHaveBeenCalledTimes(2);
    approval.status = "approved";
    await Promise.all([executeSavedWorkflowRun({ tenantId: "tenant" }, "run", execute), executeSavedWorkflowRun({ tenantId: "tenant" }, "run", execute)]);
    expect(run.status).toBe("completed");
    expect(execute.mock.calls.map((call) => call[3].id)).toEqual(["start", "approval", "notify"]);
    expect(run.stateJson.executions.find((step) => step.nodeId === "approval")).toMatchObject({ status: "success", outcome: "approved" });
  });

  it("does not replay an interrupted running node with unknown external outcome", async () => {
    const { run, execute } = fixture();
    run.status = "running";
    await executeSavedWorkflowRun({ tenantId: "tenant" }, "run", execute);
    expect(execute).not.toHaveBeenCalled();
  });

  it("cannot load another tenant's run", async () => {
    const { execute } = fixture();
    await executeSavedWorkflowRun({ tenantId: "other" }, "run", execute);
    expect(execute).not.toHaveBeenCalled();
  });

  it("stops if the original actor was disabled before execution", async () => {
    const { run, execute } = fixture();
    run.actor.status = "inactive";
    await executeSavedWorkflowRun({ tenantId: "tenant" }, "run", execute);
    expect(run.status).toBe("failed");
    expect(run.error).toContain("無効");
    expect(execute).not.toHaveBeenCalled();
  });

  it("fences a stale worker before a subsequent node and never overwrites a replacement lease", async () => {
    const { run, execute } = fixture();
    execute.mockImplementation(async () => {
      run.leaseToken = "replacement-worker";
      return undefined;
    });
    await executeSavedWorkflowRun({ tenantId: "tenant" }, "run", execute);
    expect(execute).toHaveBeenCalledOnce();
    expect(run.status).toBe("running");
    expect(run.leaseToken).toBe("replacement-worker");
    expect(recordAuditLog).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actionType: "WORKFLOW_FAILED" }), expect.anything());
  });

  it("quarantines an unknown external result even when failurePolicy permits continuation", async () => {
    const { run, execute } = fixture();
    const graph = structuredClone(definition);
    graph.nodes[0].data.nodeType = "api_call";
    graph.nodes[0].data.config = { failurePolicy: "continue" };
    run.definitionJson = graph;
    run.stateJson.queue = ["notify"];
    execute.mockRejectedValue(new WorkflowUncertainOutcomeError("response lost"));
    await executeSavedWorkflowRun({ tenantId: "tenant" }, "run", execute);
    expect(run.status).toBe("interrupted");
    expect(run.leaseToken).toBeNull();
    expect(run.stateJson.executions[0].status).toBe("running");
  });

  it("yields long execution between checkpoints and resumes without replaying completed nodes", async () => {
    const { run, execute } = fixture();
    const started = Date.now();
    let clock = started;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    execute.mockImplementationOnce(async () => { clock += 46000; });
    await executeSavedWorkflowRun({ tenantId: "tenant" }, "run", execute);
    expect(run.status).toBe("ready");
    expect(run.leaseToken).toBeNull();
    expect(run.stateJson.queue).toEqual(["approval"]);
    await executeSavedWorkflowRun({ tenantId: "tenant" }, "run", execute);
    expect(run.status).toBe("waiting");
    expect(execute.mock.calls.map((call) => call[3].id)).toEqual(["start", "approval"]);
  });

  it("requeues only DB-atomic unfinished nodes and preserves checkpoints and unrelated pending branches", () => {
    const state: WorkflowRunState = { queue: ["notify"], executions: [
      { nodeId: "start", nodeType: "trigger", status: "success", startedAt: "2026-09-30T00:00:00Z" },
      { nodeId: "approval", nodeType: "approval", status: "running", startedAt: "2026-09-30T00:00:01Z" },
    ] };
    const recovered = expiredRunRecovery(state, definition);
    expect(recovered).toMatchObject({ status: "ready", state: { queue: ["approval", "notify"], executions: [expect.objectContaining({ nodeId: "start" })] } });
    expect(state.executions).toHaveLength(2);
  });

  it.each(["api_call", "ai_action"] as const)("never requeues an unfinished %s automatically", (nodeType) => {
    const graph = structuredClone(definition);
    graph.nodes[0].data.nodeType = nodeType;
    const state: WorkflowRunState = { queue: [], executions: [{ nodeId: "notify", nodeType, status: "running", startedAt: "2026-09-30T00:00:00Z" }] };
    expect(expiredRunRecovery(state, graph)).toMatchObject({ status: "interrupted", state });
  });
});

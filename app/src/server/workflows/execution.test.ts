import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeSavedWorkflowRun, type WorkflowNodeExecutor } from "./execution";
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
  };
  const approval = { id: "approval", status: "pending" };
  const prisma = {
    workflowRun: {
      findFirst: vi.fn(async ({ where }) => where.tenantId === run.tenantId ? structuredClone(run) : null),
      updateMany: vi.fn(async ({ where, data }) => {
        if (where.status !== run.status) return { count: 0 };
        Object.assign(run, data);
        return { count: 1 };
      }),
      update: vi.fn(async ({ data }) => Object.assign(run, data)),
    },
    approval: { findFirst: vi.fn(async () => approval) },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (action) => action(prisma));
  getPrismaClient.mockReturnValue(prisma);
  const execute = vi.fn<WorkflowNodeExecutor>(async (_actor, _input, _workflow, node) => node.id === "approval" ? { approvalId: "approval" } : undefined);
  return { run, approval, execute };
}

describe("durable workflow execution", () => {
  beforeEach(() => { vi.clearAllMocks(); requirePermission.mockResolvedValue(undefined); });

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
});

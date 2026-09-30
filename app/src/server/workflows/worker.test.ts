import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchPendingWorkflowRuns, recoverExpiredWorkflowRuns, workflowBatchLimit } from "./worker";

const mocks = vi.hoisted(() => ({ getPrismaClient: vi.fn(), recordAuditLog: vi.fn(), dispatchWorkflowRunIds: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({ getPrismaClient: mocks.getPrismaClient }));
vi.mock("@/server/audit/service", () => ({ recordAuditLog: mocks.recordAuditLog }));
vi.mock("./service", () => ({ dispatchWorkflowRunIds: mocks.dispatchWorkflowRunIds }));

describe("workflow dispatch worker", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([0, -1, 51, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid batch limit %s", (limit) => {
    expect(() => workflowBatchLimit(limit)).toThrow();
  });

  it("keeps a bounded failed dispatch recoverable and continues the batch for other tenants", async () => {
    const transaction = { $queryRaw: vi.fn().mockResolvedValue([]) };
    const prisma = {
      $transaction: vi.fn(async (action) => action(transaction)),
      $queryRaw: vi.fn().mockResolvedValue([{ id: "first", tenant_id: "tenant_a" }, { id: "second", tenant_id: "tenant_b" }]),
      workflowRun: { findUniqueOrThrow: vi.fn().mockResolvedValue({ status: "waiting" }) },
    };
    mocks.getPrismaClient.mockReturnValue(prisma);
    mocks.dispatchWorkflowRunIds.mockRejectedValueOnce(new Error("database temporarily unavailable")).mockResolvedValueOnce([]);
    expect(await dispatchPendingWorkflowRuns(2)).toMatchObject({
      recovered: [], processed: [{ id: "second", status: "waiting" }], failures: [{ id: "first", message: "database temporarily unavailable" }],
    });
    expect(mocks.dispatchWorkflowRunIds.mock.calls).toEqual([[{ tenantId: "tenant_a" }, ["first"]], [{ tenantId: "tenant_b" }, ["second"]]]);
  });

  it("recovers only locked expired rows and audits quarantine in the same transaction", async () => {
    const run = {
      id: "run", actor: { id: "actor", tenantId: "tenant", name: "Actor", email: "actor@example.com" }, workflowName: "External", recordId: "record", leaseToken: "old",
      definitionJson: { nodes: [{ id: "api", data: { nodeType: "api_call" } }], edges: [] },
      stateJson: { queue: [], executions: [{ nodeId: "api", nodeType: "api_call", status: "running" }] },
    };
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: run.id }]),
      workflowRun: { findUniqueOrThrow: vi.fn().mockResolvedValue(run), update: vi.fn() },
    };
    mocks.getPrismaClient.mockReturnValue({ $transaction: vi.fn(async (action) => action(transaction)) });
    expect(await recoverExpiredWorkflowRuns(1)).toEqual([{ id: "run", status: "interrupted" }]);
    expect(transaction.workflowRun.update).toHaveBeenCalledWith({ where: { id: "run" }, data: expect.objectContaining({ status: "interrupted", leaseToken: null, leaseExpiresAt: null }) });
    expect(mocks.recordAuditLog).toHaveBeenCalledWith(run.actor, expect.objectContaining({ actionType: "WORKFLOW_INTERRUPTED" }), transaction);
    expect(mocks.dispatchWorkflowRunIds).not.toHaveBeenCalled();
  });
});

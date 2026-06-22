import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDueScheduledWorkflows } from "@/server/workflows/scheduler";

const { getPrismaClient, runApprovalWorkflowsForRecord } = vi.hoisted(() => ({
  getPrismaClient: vi.fn(),
  runApprovalWorkflowsForRecord: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({ getPrismaClient }));
vi.mock("@/server/workflows/service", () => ({ runApprovalWorkflowsForRecord }));

describe("workflow scheduler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs active schedule workflows for trigger-scoped records", async () => {
    const appTableFindMany = vi.fn().mockResolvedValue([
      { id: "table_1", code: "tickets", name: "Tickets" },
    ]);
    getPrismaClient.mockReturnValue({
      workflow: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "workflow_1",
            tenantId: "tenant_1",
            appId: "app_1",
            definitionJson: {
              nodes: [{ data: { nodeType: "trigger", config: { tableCode: "tickets" } } }],
            },
            app: { code: "support" },
            createdBy: {
              id: "user_1",
              tenantId: "tenant_1",
              email: "owner@example.com",
              name: "Owner",
              avatarUrl: null,
              status: "active",
              lastLoginAt: null,
              createdAt: new Date("2026-01-01T00:00:00Z"),
            },
          },
        ]),
      },
      appTable: { findMany: appTableFindMany },
      appRecord: {
        findMany: vi.fn().mockResolvedValue([
          { id: "record_1", dataJson: { title: "Scheduled ticket" } },
        ]),
      },
    });
    runApprovalWorkflowsForRecord.mockResolvedValue([{ id: "approval_1" }]);

    const result = await runDueScheduledWorkflows(10);

    expect(appTableFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ code: "tickets" }),
      })
    );
    expect(runApprovalWorkflowsForRecord).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user_1" }),
      expect.objectContaining({
        recordId: "record_1",
        triggerTypes: ["schedule"],
        workflowIds: ["workflow_1"],
      })
    );
    expect(result).toMatchObject({ workflowCount: 1, recordCount: 1, approvalCount: 1 });
  });
});

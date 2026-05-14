import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_WORKFLOW_DEFINITION,
  listWorkflowsForApp,
  runApprovalWorkflowsForRecord,
  updateApprovalDecision,
} from "@/server/workflows/service";
import type { User } from "@/types/user";

const { getPrismaClient, recordAuditLog, ensureDemoBuilderData } = vi.hoisted(
  () => ({
    getPrismaClient: vi.fn(),
    recordAuditLog: vi.fn(),
    ensureDemoBuilderData: vi.fn().mockResolvedValue(undefined),
  })
);

vi.mock("@/server/db/prisma", () => ({
  getPrismaClient,
}));

vi.mock("@/server/audit/service", () => ({
  recordAuditLog,
}));

vi.mock("@/server/apps/bootstrap", () => ({
  ensureDemoBuilderData,
}));

const user: User = {
  id: "user_1",
  tenantId: "tenant_1",
  email: "owner@example.com",
  name: "Owner",
  status: "active",
  createdAt: "2026-04-24T00:00:00.000Z",
};

const workflowRecord = {
  id: "wf_1",
  tenantId: "tenant_1",
  appId: "app_1",
  name: "標準承認フロー",
  triggerType: "update" as const,
  status: "active" as const,
  definitionJson: DEFAULT_WORKFLOW_DEFINITION,
  createdById: "user_1",
  createdAt: new Date("2026-05-13T00:00:00.000Z"),
  updatedAt: new Date("2026-05-13T00:00:00.000Z"),
  _count: { approvals: 0 },
};

function approvalRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "appr_1",
    tenantId: "tenant_1",
    appId: "app_1",
    tableId: "tbl_1",
    recordId: "rec_1",
    workflowId: "wf_1",
    approverId: "user_1",
    requestedById: "user_1",
    actedById: null,
    status: "pending",
    title: "問い合わせの承認",
    description: "承認が必要です。",
    commentText: null,
    actedAt: null,
    createdAt: new Date("2026-05-13T00:00:00.000Z"),
    updatedAt: new Date("2026-05-13T00:00:00.000Z"),
    app: { name: "Support Desk" },
    table: { name: "Tickets" },
    workflow: { name: "標準承認フロー" },
    record: {
      id: "rec_1",
      dataJson: { title: "問い合わせ" },
    },
    requestedBy: { name: "Owner", email: "owner@example.com" },
    approver: { name: "Owner", email: "owner@example.com" },
    actedBy: null,
    ...overrides,
  };
}

describe("workflows service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureDemoBuilderData.mockResolvedValue(undefined);
  });

  it("creates a default workflow when an app has none", async () => {
    const prisma = {
      app: {
        findFirst: vi.fn().mockResolvedValue({
          id: "app_1",
          tenantId: "tenant_1",
          code: "support-desk",
        }),
      },
      workflow: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(workflowRecord),
        findMany: vi.fn().mockResolvedValue([workflowRecord]),
      },
      approval: {
        count: vi.fn().mockResolvedValue(0),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const workflows = await listWorkflowsForApp(user, "app_1");

    expect(prisma.workflow.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        appId: "app_1",
        status: "active",
        triggerType: "update",
      }),
    });
    expect(workflows).toEqual([
      expect.objectContaining({
        id: "wf_1",
        name: "標準承認フロー",
        pendingApprovalCount: 0,
      }),
    ]);
  });

  it("creates pending approvals for active workflows with approval nodes", async () => {
    const prisma = {
      workflow: {
        findMany: vi.fn().mockResolvedValue([workflowRecord]),
      },
      approval: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(approvalRecord()),
      },
      appRecord: {
        update: vi.fn().mockResolvedValue({
          id: "rec_1",
          status: "pending_approval",
        }),
      },
      recordComment: {
        create: vi.fn().mockResolvedValue({ id: "comment_1" }),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const approvals = await runApprovalWorkflowsForRecord(user, {
      appId: "app_1",
      appCode: "support-desk",
      tableId: "tbl_1",
      tableCode: "tickets",
      tableName: "Tickets",
      recordId: "rec_1",
      recordTitle: "問い合わせ",
      triggerTypes: ["update"],
    });

    expect(prisma.workflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "active",
          triggerType: { in: ["update"] },
        }),
      })
    );
    expect(prisma.approval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowId: "wf_1",
          recordId: "rec_1",
        }),
      })
    );
    expect(prisma.appRecord.update).toHaveBeenCalledWith({
      where: { id: "rec_1" },
      data: {
        status: "pending_approval",
        updatedById: "user_1",
      },
    });
    expect(prisma.recordComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recordId: "rec_1",
          isSystem: true,
        }),
      })
    );
    expect(approvals[0]).toEqual(
      expect.objectContaining({
        id: "appr_1",
        status: "pending",
        recordTitle: "問い合わせ",
      })
    );
    expect(recordAuditLog).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ actionType: "APPROVAL_CREATE" })
    );
  });

  it("updates approval decision and record status together", async () => {
    const definitionWithCustomStatuses = {
      ...DEFAULT_WORKFLOW_DEFINITION,
      nodes: DEFAULT_WORKFLOW_DEFINITION.nodes.map((node) =>
        node.data.nodeType === "approval"
          ? {
              ...node,
              data: {
                ...node.data,
                config: {
                  ...node.data.config,
                  approvedStatus: "ready_to_publish",
                  rejectedStatus: "changes_requested",
                },
              },
            }
          : node
      ),
    };
    const approvedApproval = approvalRecord({
      status: "approved",
      commentText: "確認しました。",
      actedById: "user_1",
      actedAt: new Date("2026-05-13T01:00:00.000Z"),
      actedBy: { name: "Owner", email: "owner@example.com" },
    });
    const tx = {
      approval: {
        update: vi.fn().mockResolvedValue(approvedApproval),
      },
      appRecord: {
        update: vi.fn().mockResolvedValue({ id: "rec_1" }),
      },
      recordComment: {
        create: vi.fn().mockResolvedValue({ id: "comment_1" }),
      },
    };
    const prisma = {
      approval: {
        findFirst: vi.fn().mockResolvedValue(
          approvalRecord({
            record: {
              id: "rec_1",
              status: "pending_approval",
              dataJson: { title: "問い合わせ" },
            },
            workflow: {
              id: "wf_1",
              name: "Default approval workflow",
              definitionJson: definitionWithCustomStatuses,
            },
          })
        ),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };

    getPrismaClient.mockReturnValue(prisma);

    const approval = await updateApprovalDecision(user, "appr_1", {
      status: "approved",
      commentText: "確認しました。",
    });

    expect(tx.approval.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "approved",
          commentText: "確認しました。",
          actedById: "user_1",
        }),
      })
    );
    expect(tx.appRecord.update).toHaveBeenCalledWith({
      where: { id: "rec_1" },
      data: {
        status: "ready_to_publish",
        updatedById: "user_1",
      },
    });
    expect(tx.recordComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recordId: "rec_1",
          isSystem: true,
        }),
      })
    );
    expect(approval.status).toBe("approved");
  });
});

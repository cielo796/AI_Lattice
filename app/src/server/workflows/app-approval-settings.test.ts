import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveAppApprovalSetting,
  submitAppApprovalForRecord,
} from "@/server/workflows/app-approval-settings";
import type { User } from "@/types/user";

const {
  createNotificationsForUsers,
  ensureDemoBuilderData,
  getPrismaClient,
  recordAuditLog,
  requirePermission,
} = vi.hoisted(() => ({
  createNotificationsForUsers: vi.fn(),
  ensureDemoBuilderData: vi.fn().mockResolvedValue(undefined),
  getPrismaClient: vi.fn(),
  recordAuditLog: vi.fn(),
  requirePermission: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/db/prisma", () => ({ getPrismaClient }));
vi.mock("@/server/admin/rbac", () => ({ requirePermission }));
vi.mock("@/server/apps/bootstrap", () => ({ ensureDemoBuilderData }));
vi.mock("@/server/audit/service", () => ({ recordAuditLog }));
vi.mock("@/server/notifications/service", () => ({
  createNotificationsForUsers,
}));

const user: User = {
  id: "user_1",
  tenantId: "tenant_1",
  email: "owner@example.com",
  name: "Owner",
  status: "active",
  createdAt: "2026-04-24T00:00:00.000Z",
};

const app = {
  id: "app_1",
  tenantId: "tenant_1",
  name: "Expense App",
  code: "expenses",
  tables: [{ id: "tbl_1", code: "requests", name: "Requests" }],
};

const table = {
  id: "tbl_1",
  tenantId: "tenant_1",
  appId: "app_1",
  code: "requests",
  name: "Requests",
};

const setting = {
  id: "setting_1",
  tenantId: "tenant_1",
  appId: "app_1",
  enabled: false,
  approvalMode: "any" as const,
  targetTableId: "tbl_1",
  pendingStatus: "pending_approval",
  approvedStatus: "approved",
  rejectedStatus: "rejected",
  returnedStatus: "returned",
  quorumCount: null,
  requestTitleTemplate: null,
  requestBodyTemplate: null,
  conditionJson: null,
  postApprovalActionsJson: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  approvers: [],
};

function approvalRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "approval_1",
    tenantId: "tenant_1",
    appId: "app_1",
    tableId: "tbl_1",
    recordId: "rec_1",
    workflowId: null,
    appApprovalSettingId: "setting_1",
    approverId: "approver_1",
    requestedById: "user_1",
    actedById: null,
    status: "pending",
    title: "Expense approval",
    description: "Please approve this expense.",
    commentText: null,
    approvalMode: "all",
    actedAt: null,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    app: { name: "Expense App" },
    table: { name: "Requests" },
    record: { id: "rec_1", dataJson: { title: "Taxi" } },
    requestedBy: { name: "Owner", email: "owner@example.com" },
    approver: { name: "Manager", email: "manager@example.com" },
    actedBy: null,
    assignees: [
      {
        id: "assignee_1",
        approvalId: "approval_1",
        userId: "approver_1",
        status: "pending",
        commentText: null,
        actedAt: null,
        sortOrder: 0,
        required: true,
        active: true,
        user: { name: "Manager", email: "manager@example.com" },
      },
    ],
    ...overrides,
  };
}

describe("app approval settings service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureDemoBuilderData.mockResolvedValue(undefined);
    requirePermission.mockResolvedValue(undefined);
  });

  it("saves app approval settings with multiple approver inputs", async () => {
    const updatedSetting = {
      ...setting,
      enabled: true,
      approvalMode: "all" as const,
      approvers: [
        {
          id: "approver_setting_1",
          tenantId: "tenant_1",
          settingId: "setting_1",
          approverType: "user",
          userId: "approver_1",
          roleId: null,
          roleType: null,
          sortOrder: 0,
          required: true,
          active: true,
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
          updatedAt: new Date("2026-06-01T00:00:00.000Z"),
          user: { name: "Manager", email: "manager@example.com" },
          role: null,
        },
        {
          id: "approver_setting_2",
          tenantId: "tenant_1",
          settingId: "setting_1",
          approverType: "role",
          userId: null,
          roleId: "role_approver",
          roleType: "approver" as const,
          sortOrder: 1,
          required: true,
          active: true,
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
          updatedAt: new Date("2026-06-01T00:00:00.000Z"),
          user: null,
          role: { name: "Approver" },
        },
      ],
    };
    const tx = {
      appApprovalSetting: {
        update: vi.fn().mockResolvedValue(updatedSetting),
        findUniqueOrThrow: vi.fn().mockResolvedValue(updatedSetting),
      },
      appApprovalApprover: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      app: { findFirst: vi.fn().mockResolvedValue(app) },
      appTable: { findFirst: vi.fn().mockResolvedValue({ id: "tbl_1" }) },
      appApprovalSetting: {
        findUnique: vi.fn().mockResolvedValue(setting),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: "approver_1" }),
      },
      role: {
        findFirst: vi.fn().mockResolvedValue({ id: "role_approver" }),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };

    getPrismaClient.mockReturnValue(prisma);

    const result = await saveAppApprovalSetting(user, "app_1", {
      enabled: true,
      approvalMode: "all",
      targetTableId: "tbl_1",
      approvers: [
        { approverType: "user", userId: "approver_1" },
        { approverType: "role", roleType: "approver" },
      ],
    });

    expect(tx.appApprovalSetting.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enabled: true,
          approvalMode: "all",
          targetTableId: "tbl_1",
        }),
      })
    );
    expect(tx.appApprovalApprover.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: "approver_1", approverType: "user" }),
        expect.objectContaining({ roleId: "role_approver", approverType: "role" }),
      ]),
    });
    expect(result.approvers).toHaveLength(2);
    expect(recordAuditLog).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ actionType: "APP_APPROVAL_SETTING_UPDATE" })
    );
  });

  it("submits an app approval and creates assignees for the record", async () => {
    const activeSetting = {
      ...setting,
      enabled: true,
      approvalMode: "all" as const,
      postApprovalActionsJson: {
        approved: [{ status: "approved", dataPatch: { approved: true } }],
      },
      approvers: [
        {
          id: "approver_setting_1",
          tenantId: "tenant_1",
          settingId: "setting_1",
          approverType: "user",
          userId: "approver_1",
          roleId: null,
          roleType: null,
          sortOrder: 0,
          required: true,
          active: true,
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
          updatedAt: new Date("2026-06-01T00:00:00.000Z"),
        },
        {
          id: "approver_setting_2",
          tenantId: "tenant_1",
          settingId: "setting_1",
          approverType: "user",
          userId: "approver_2",
          roleId: null,
          roleType: null,
          sortOrder: 1,
          required: true,
          active: true,
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
          updatedAt: new Date("2026-06-01T00:00:00.000Z"),
        },
      ],
    };
    const tx = {
      approval: {
        create: vi.fn().mockResolvedValue({ id: "approval_1" }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(
          approvalRecord({
            approvalMode: "all",
            assignees: [
              {
                id: "assignee_1",
                approvalId: "approval_1",
                userId: "approver_1",
                status: "pending",
                commentText: null,
                actedAt: null,
                sortOrder: 0,
                required: true,
                active: true,
                user: { name: "Manager", email: "manager@example.com" },
              },
              {
                id: "assignee_2",
                approvalId: "approval_1",
                userId: "approver_2",
                status: "pending",
                commentText: null,
                actedAt: null,
                sortOrder: 1,
                required: true,
                active: true,
                user: { name: "Director", email: "director@example.com" },
              },
            ],
          })
        ),
      },
      approvalAssignee: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      appRecord: {
        update: vi.fn().mockResolvedValue({ id: "rec_1", status: "pending_approval" }),
      },
      recordComment: {
        create: vi.fn().mockResolvedValue({ id: "comment_1" }),
      },
    };
    const prisma = {
      app: { findFirst: vi.fn().mockResolvedValue(app) },
      appTable: { findFirst: vi.fn().mockResolvedValue(table) },
      appRecord: {
        findFirst: vi.fn().mockResolvedValue({
          id: "rec_1",
          tenantId: "tenant_1",
          appId: "app_1",
          tableId: "tbl_1",
          status: "active",
          dataJson: { title: "Taxi" },
        }),
      },
      appApprovalSetting: {
        findUnique: vi.fn().mockResolvedValue(activeSetting),
      },
      approval: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };

    getPrismaClient.mockReturnValue(prisma);

    const result = await submitAppApprovalForRecord(
      user,
      "expenses",
      "requests",
      "rec_1",
      { title: "Expense approval" }
    );

    expect(tx.approval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appApprovalSettingId: "setting_1",
          approvalMode: "all",
          pendingStatus: "pending_approval",
        }),
      })
    );
    expect(tx.approvalAssignee.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: "approver_1" }),
        expect.objectContaining({ userId: "approver_2" }),
      ]),
    });
    expect(tx.appRecord.update).toHaveBeenCalledWith({
      where: { id: "rec_1" },
      data: { status: "pending_approval", updatedById: "user_1" },
    });
    expect(createNotificationsForUsers).toHaveBeenCalledWith(
      user,
      expect.arrayContaining([
        expect.objectContaining({ recipientId: "approver_1" }),
        expect.objectContaining({ recipientId: "approver_2" }),
      ])
    );
    expect(result.assignees).toHaveLength(2);
  });
});

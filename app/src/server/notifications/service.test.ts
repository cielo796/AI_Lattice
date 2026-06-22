import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNotification,
  listWorkflowNotificationRecipients,
  markNotificationReadForUser,
} from "@/server/notifications/service";

const { getPrismaClient, requirePermission } = vi.hoisted(() => ({
  getPrismaClient: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  getPrismaClient,
}));

vi.mock("@/server/admin/rbac", () => ({
  requirePermission,
}));

const user = {
  id: "user_1",
  tenantId: "tenant_1",
  email: "owner@example.com",
  name: "Owner",
  status: "active" as const,
  createdAt: "2026-04-24T00:00:00.000Z",
};

function notificationRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "notif_1",
    tenantId: "tenant_1",
    recipientId: "user_1",
    actorId: "actor_1",
    appId: "app_1",
    recordId: "rec_1",
    type: "workflow",
    title: "Workflow done",
    body: "The workflow completed.",
    href: "/run/app/table?recordId=rec_1",
    readAt: null,
    createdAt: new Date("2026-06-15T00:00:00Z"),
    actor: { name: "Actor", email: "actor@example.com" },
    app: { name: "Support Desk" },
    ...overrides,
  };
}

describe("notifications service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue(undefined);
  });

  it("creates tenant-scoped notifications", async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: "user_1" }) },
      notification: {
        create: vi.fn().mockResolvedValue(notificationRecord()),
      },
    };
    getPrismaClient.mockReturnValue(prisma);

    const notification = await createNotification(user, {
      recipientId: "user_1",
      actorId: "actor_1",
      appId: "app_1",
      recordId: "rec_1",
      type: "workflow",
      title: "Workflow done",
    });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant_1",
          recipientId: "user_1",
          type: "workflow",
        }),
      })
    );
    expect(notification).toMatchObject({
      id: "notif_1",
      actorName: "Actor",
      appName: "Support Desk",
    });
  });

  it("marks only the current user's notification read", async () => {
    const prisma = {
      notification: {
        findFirst: vi.fn().mockResolvedValue(notificationRecord()),
        update: vi.fn().mockResolvedValue(
          notificationRecord({ readAt: new Date("2026-06-15T00:05:00Z") })
        ),
      },
    };
    getPrismaClient.mockReturnValue(prisma);

    const notification = await markNotificationReadForUser(user, "notif_1");

    expect(prisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant_1",
          recipientId: "user_1",
        }),
      })
    );
    expect(notification.readAt).toBe("2026-06-15T00:05:00.000Z");
  });

  it("resolves workflow notification recipients from role assignments", async () => {
    getPrismaClient.mockReturnValue({
      userRole: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ userId: "approver_1" }, { userId: "approver_1" }]),
      },
    });

    await expect(
      listWorkflowNotificationRecipients(
        { tenantId: "tenant_1" },
        { roleType: "approver" },
        "fallback_1"
      )
    ).resolves.toEqual(["approver_1"]);
  });
});


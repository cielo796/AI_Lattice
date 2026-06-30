import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveNotificationForUser,
  createNotification,
  deleteNotificationForUser,
  listNotificationsForUser,
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
    dedupeKey: null,
    deliveryStatus: "sent",
    deliveryError: null,
    deliveredAt: new Date("2026-06-15T00:00:00Z"),
    readAt: null,
    archivedAt: null,
    deletedAt: null,
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
      userNotificationPreference: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
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

  it("deduplicates notifications by key and restores visibility", async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: "user_1" }) },
      userNotificationPreference: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue(notificationRecord({ readAt: new Date() })),
        update: vi.fn().mockResolvedValue(notificationRecord({ title: "Updated" })),
        create: vi.fn(),
      },
    };
    getPrismaClient.mockReturnValue(prisma);

    const notification = await createNotification(user, {
      recipientId: "user_1",
      type: "workflow",
      title: "Updated",
      dedupeKey: "workflow:wf_1:node:n_1:record:r_1",
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Updated",
          readAt: null,
          archivedAt: null,
          deletedAt: null,
        }),
      })
    );
    expect(notification?.title).toBe("Updated");
  });

  it("lists paginated notifications with a tenant-scoped unread count", async () => {
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([
          notificationRecord({ id: "notif_2" }),
          notificationRecord({ id: "notif_1" }),
        ]),
        count: vi.fn().mockResolvedValue(7),
      },
    };
    getPrismaClient.mockReturnValue(prisma);

    const page = await listNotificationsForUser(user, { limit: 1 });

    expect(requirePermission).toHaveBeenCalledWith(user, "notifications:read");
    expect(page.notifications).toHaveLength(1);
    expect(page.unreadCount).toBe(7);
    expect(page.nextCursor).toContain("notif_2");
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

  it("archives and deletes only the current user's notifications", async () => {
    const prisma = {
      notification: {
        findFirst: vi.fn().mockResolvedValue(notificationRecord()),
        update: vi
          .fn()
          .mockResolvedValueOnce(
            notificationRecord({ archivedAt: new Date("2026-06-15T00:10:00Z") })
          )
          .mockResolvedValueOnce(notificationRecord({ deletedAt: new Date() })),
      },
    };
    getPrismaClient.mockReturnValue(prisma);

    const archived = await archiveNotificationForUser(user, "notif_1");
    await deleteNotificationForUser(user, "notif_1");

    expect(archived.archivedAt).toBe("2026-06-15T00:10:00.000Z");
    expect(prisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant_1",
          recipientId: "user_1",
        }),
      })
    );
    expect(prisma.notification.update).toHaveBeenCalledTimes(2);
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

import { AppsServiceError } from "@/server/apps/service";
import { getPrismaClient } from "@/server/db/prisma";
import { requirePermission } from "@/server/admin/rbac";
import type {
  Notification,
  NotificationPage,
  NotificationPreference,
} from "@/types/notification";
import type { User } from "@/types/user";

export interface ListNotificationsOptions {
  unreadOnly?: boolean;
  archivedOnly?: boolean;
  limit?: number;
  cursor?: string;
}

export interface CreateNotificationInput {
  recipientId: string;
  actorId?: string;
  appId?: string;
  recordId?: string;
  type?: Notification["type"];
  title: string;
  body?: string;
  href?: string;
  dedupeKey?: string;
}

const DEFAULT_NOTIFICATION_LIMIT = 50;
const MAX_NOTIFICATION_LIMIT = 200;
const NOTIFICATION_TYPES: Notification["type"][] = [
  "info",
  "approval",
  "workflow",
  "ai",
  "system",
];

function normalizeLimit(limit: number | undefined) {
  if (!Number.isInteger(limit) || !limit || limit <= 0) {
    return DEFAULT_NOTIFICATION_LIMIT;
  }

  return Math.min(limit, MAX_NOTIFICATION_LIMIT);
}

function assertNonEmpty(value: string | undefined, fieldName: string) {
  if (!value || !value.trim()) {
    throw new AppsServiceError(`${fieldName}は必須です。`, 400);
  }

  return value.trim();
}

function assertNotificationType(value: string | undefined): Notification["type"] {
  const normalized = value as Notification["type"] | undefined;

  if (normalized && NOTIFICATION_TYPES.includes(normalized)) {
    return normalized;
  }

  return "info";
}

function isRoleType(value: string) {
  return (
    value === "system_admin" ||
    value === "tenant_admin" ||
    value === "app_admin" ||
    value === "approver" ||
    value === "user" ||
    value === "viewer"
  );
}

function toNotification(notification: {
  id: string;
  tenantId: string;
  recipientId: string;
  actorId: string | null;
  appId: string | null;
  recordId: string | null;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  dedupeKey: string | null;
  deliveryStatus: string;
  deliveryError: string | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  actor?: { name: string; email: string } | null;
  app?: { name: string } | null;
}): Notification {
  return {
    id: notification.id,
    tenantId: notification.tenantId,
    recipientId: notification.recipientId,
    actorId: notification.actorId ?? undefined,
    actorName: notification.actor?.name ?? notification.actor?.email,
    appId: notification.appId ?? undefined,
    appName: notification.app?.name,
    recordId: notification.recordId ?? undefined,
    type: notification.type as Notification["type"],
    title: notification.title,
    body: notification.body ?? undefined,
    href: notification.href ?? undefined,
    dedupeKey: notification.dedupeKey ?? undefined,
    deliveryStatus: notification.deliveryStatus as Notification["deliveryStatus"],
    deliveryError: notification.deliveryError ?? undefined,
    deliveredAt: notification.deliveredAt?.toISOString(),
    readAt: notification.readAt?.toISOString(),
    archivedAt: notification.archivedAt?.toISOString(),
    deletedAt: notification.deletedAt?.toISOString(),
    createdAt: notification.createdAt.toISOString(),
  };
}

function notificationInclude() {
  return {
    actor: { select: { name: true, email: true } },
    app: { select: { name: true } },
  };
}

function makeCursor(notification: { id: string; createdAt: Date }) {
  return `${notification.createdAt.toISOString()}|${notification.id}`;
}

function parseCursor(cursor: string | undefined) {
  if (!cursor) {
    return null;
  }

  const [createdAtValue, id] = cursor.split("|");
  const createdAt = new Date(createdAtValue ?? "");

  if (!id || Number.isNaN(createdAt.getTime())) {
    return null;
  }

  return { createdAt, id };
}

function cursorWhere(cursor: string | undefined) {
  const parsed = parseCursor(cursor);

  if (!parsed) {
    return {};
  }

  return {
    OR: [
      { createdAt: { lt: parsed.createdAt } },
      { createdAt: parsed.createdAt, id: { lt: parsed.id } },
    ],
  };
}

async function isInAppNotificationEnabled(
  tenantId: string,
  userId: string,
  type: Notification["type"]
) {
  const prisma = getPrismaClient();
  const preferences = (
    prisma as typeof prisma & {
      userNotificationPreference?: typeof prisma.userNotificationPreference;
    }
  ).userNotificationPreference;

  if (!preferences) {
    return true;
  }

  const preference = await preferences.findUnique({
    where: { userId_type: { userId, type } },
    select: { inAppEnabled: true },
  });

  return preference?.inAppEnabled ?? true;
}

export async function createNotification(
  user: Pick<User, "tenantId">,
  input: CreateNotificationInput
) {
  const prisma = getPrismaClient();
  const type = assertNotificationType(input.type);
  const recipient = await prisma.user.findFirst({
    where: {
      id: assertNonEmpty(input.recipientId, "通知先"),
      tenantId: user.tenantId,
    },
    select: { id: true },
  });

  if (!recipient) {
    throw new AppsServiceError("通知先ユーザーが見つかりません。", 404);
  }

  const enabled = await isInAppNotificationEnabled(
    user.tenantId,
    recipient.id,
    type
  );

  if (!enabled) {
    return null;
  }

  const now = new Date();
  const dedupeKey = input.dedupeKey?.trim() || undefined;

  const notificationModel = prisma.notification as typeof prisma.notification & {
    findFirst?: typeof prisma.notification.findFirst;
  };

  if (dedupeKey && notificationModel.findFirst) {
    const existing = await notificationModel.findFirst({
      where: {
        tenantId: user.tenantId,
        recipientId: recipient.id,
        dedupeKey,
      },
    });

    if (existing) {
      const updated = await prisma.notification.update({
        where: { id: existing.id },
        data: {
          actorId: input.actorId,
          appId: input.appId,
          recordId: input.recordId,
          type,
          title: assertNonEmpty(input.title, "通知タイトル"),
          body: input.body?.trim() || undefined,
          href: input.href?.trim() || undefined,
          deliveryStatus: "sent",
          deliveryError: null,
          deliveredAt: now,
          readAt: null,
          archivedAt: null,
          deletedAt: null,
        },
        include: notificationInclude(),
      });

      return toNotification(updated);
    }
  }

  const notification = await prisma.notification.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      recipientId: recipient.id,
      actorId: input.actorId,
      appId: input.appId,
      recordId: input.recordId,
      type,
      title: assertNonEmpty(input.title, "通知タイトル"),
      body: input.body?.trim() || undefined,
      href: input.href?.trim() || undefined,
      dedupeKey,
      deliveryStatus: "sent",
      deliveredAt: now,
    },
    include: notificationInclude(),
  });

  return toNotification(notification);
}

export async function createNotificationsForUsers(
  user: Pick<User, "tenantId">,
  inputs: CreateNotificationInput[]
) {
  const notifications: Notification[] = [];

  for (const input of inputs) {
    const notification = await createNotification(user, input);
    if (notification) {
      notifications.push(notification);
    }
  }

  return notifications;
}

export async function listNotificationsForUser(
  user: User,
  options: ListNotificationsOptions = {}
): Promise<NotificationPage> {
  await requirePermission(user, "notifications:read");

  const prisma = getPrismaClient();
  const limit = normalizeLimit(options.limit);
  const notifications = await prisma.notification.findMany({
    where: {
      tenantId: user.tenantId,
      recipientId: user.id,
      deletedAt: null,
      ...(options.unreadOnly ? { readAt: null } : {}),
      ...(options.archivedOnly ? { archivedAt: { not: null } } : { archivedAt: null }),
      ...cursorWhere(options.cursor),
    },
    include: notificationInclude(),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const hasNext = notifications.length > limit;
  const pageItems = hasNext ? notifications.slice(0, limit) : notifications;
  const unreadCount = await prisma.notification.count({
    where: {
      tenantId: user.tenantId,
      recipientId: user.id,
      deletedAt: null,
      archivedAt: null,
      readAt: null,
    },
  });

  return {
    notifications: pageItems.map(toNotification),
    nextCursor: hasNext ? makeCursor(pageItems[pageItems.length - 1]) : undefined,
    unreadCount,
  };
}

export async function markNotificationReadForUser(
  user: User,
  notificationId: string
) {
  await requirePermission(user, "notifications:read");

  const prisma = getPrismaClient();
  const notification = await prisma.notification.findFirst({
    where: {
      id: assertNonEmpty(notificationId, "通知"),
      tenantId: user.tenantId,
      recipientId: user.id,
      deletedAt: null,
    },
  });

  if (!notification) {
    throw new AppsServiceError("通知が見つかりません。", 404);
  }

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: notification.readAt ?? new Date() },
    include: notificationInclude(),
  });

  return toNotification(updated);
}

export async function markAllNotificationsReadForUser(user: User) {
  await requirePermission(user, "notifications:read");

  const prisma = getPrismaClient();
  await prisma.notification.updateMany({
    where: {
      tenantId: user.tenantId,
      recipientId: user.id,
      deletedAt: null,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
}

export async function archiveNotificationForUser(
  user: User,
  notificationId: string
) {
  await requirePermission(user, "notifications:read");

  const prisma = getPrismaClient();
  const notification = await prisma.notification.findFirst({
    where: {
      id: assertNonEmpty(notificationId, "通知"),
      tenantId: user.tenantId,
      recipientId: user.id,
      deletedAt: null,
    },
  });

  if (!notification) {
    throw new AppsServiceError("通知が見つかりません。", 404);
  }

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: {
      archivedAt: notification.archivedAt ?? new Date(),
      readAt: notification.readAt ?? new Date(),
    },
    include: notificationInclude(),
  });

  return toNotification(updated);
}

export async function deleteNotificationForUser(
  user: User,
  notificationId: string
) {
  await requirePermission(user, "notifications:read");

  const prisma = getPrismaClient();
  const notification = await prisma.notification.findFirst({
    where: {
      id: assertNonEmpty(notificationId, "通知"),
      tenantId: user.tenantId,
      recipientId: user.id,
      deletedAt: null,
    },
  });

  if (!notification) {
    throw new AppsServiceError("通知が見つかりません。", 404);
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      deletedAt: new Date(),
      readAt: notification.readAt ?? new Date(),
    },
  });
}

export async function getUnreadNotificationCountForUser(user: User) {
  await requirePermission(user, "notifications:read");

  const prisma = getPrismaClient();
  return prisma.notification.count({
    where: {
      tenantId: user.tenantId,
      recipientId: user.id,
      deletedAt: null,
      archivedAt: null,
      readAt: null,
    },
  });
}

export async function listNotificationPreferencesForUser(
  user: User
): Promise<NotificationPreference[]> {
  await requirePermission(user, "notifications:read");

  const prisma = getPrismaClient();
  const preferences = await prisma.userNotificationPreference.findMany({
    where: {
      tenantId: user.tenantId,
      userId: user.id,
    },
  });
  const byType = new Map(
    preferences.map((preference) => [
      preference.type as Notification["type"],
      preference.inAppEnabled,
    ])
  );

  return NOTIFICATION_TYPES.map((type) => ({
    type,
    inAppEnabled: byType.get(type) ?? true,
  }));
}

export async function updateNotificationPreferencesForUser(
  user: User,
  preferences: NotificationPreference[]
) {
  await requirePermission(user, "notifications:read");

  const prisma = getPrismaClient();
  const normalized = preferences.filter((preference) =>
    NOTIFICATION_TYPES.includes(preference.type)
  );

  await prisma.$transaction(
    normalized.map((preference) =>
      prisma.userNotificationPreference.upsert({
        where: {
          userId_type: {
            userId: user.id,
            type: preference.type,
          },
        },
        update: {
          inAppEnabled: Boolean(preference.inAppEnabled),
        },
        create: {
          id: crypto.randomUUID(),
          tenantId: user.tenantId,
          userId: user.id,
          type: preference.type,
          inAppEnabled: Boolean(preference.inAppEnabled),
        },
      })
    )
  );

  return listNotificationPreferencesForUser(user);
}

export async function createManagedNotificationsForUser(
  user: User,
  input: {
    recipientIds?: string[];
    roleType?: string;
    type?: Notification["type"];
    title: string;
    body?: string;
    href?: string;
    dedupeKey?: string;
  }
) {
  await requirePermission(user, "notifications:manage");

  const recipientIds =
    input.recipientIds && input.recipientIds.length > 0
      ? input.recipientIds
      : await listWorkflowNotificationRecipients(user, input, user.id);

  return createNotificationsForUsers(
    user,
    [...new Set(recipientIds)].map((recipientId) => ({
      recipientId,
      actorId: user.id,
      type: input.type ?? "system",
      title: input.title,
      body: input.body,
      href: input.href,
      dedupeKey: input.dedupeKey,
    }))
  );
}

export async function listWorkflowNotificationRecipients(
  user: Pick<User, "tenantId">,
  config: Record<string, unknown> | undefined,
  fallbackUserId: string
) {
  const recipientIds = config?.recipientIds;

  if (Array.isArray(recipientIds)) {
    return recipientIds.filter(
      (recipientId): recipientId is string =>
        typeof recipientId === "string" && recipientId.trim().length > 0
    );
  }

  const roleType = typeof config?.roleType === "string" ? config.roleType : "";

  if (isRoleType(roleType)) {
    const prisma = getPrismaClient();
    const assignments = await prisma.userRole.findMany({
      where: {
        tenantId: user.tenantId,
        role: { roleType },
      },
      select: { userId: true },
    });
    const ids = [...new Set(assignments.map((assignment) => assignment.userId))];

    if (ids.length > 0) {
      return ids;
    }
  }

  return [fallbackUserId];
}

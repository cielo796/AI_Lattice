import { AppsServiceError } from "@/server/apps/service";
import { getPrismaClient } from "@/server/db/prisma";
import { requirePermission } from "@/server/admin/rbac";
import type { Notification } from "@/types/notification";
import type { User } from "@/types/user";

export interface ListNotificationsOptions {
  unreadOnly?: boolean;
  limit?: number;
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
}

const DEFAULT_NOTIFICATION_LIMIT = 50;
const MAX_NOTIFICATION_LIMIT = 200;

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
  if (
    value === "info" ||
    value === "approval" ||
    value === "workflow" ||
    value === "ai" ||
    value === "system"
  ) {
    return value;
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
  readAt: Date | null;
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
    readAt: notification.readAt?.toISOString(),
    createdAt: notification.createdAt.toISOString(),
  };
}

function notificationInclude() {
  return {
    actor: { select: { name: true, email: true } },
    app: { select: { name: true } },
  };
}

export async function createNotification(
  user: Pick<User, "tenantId">,
  input: CreateNotificationInput
) {
  const prisma = getPrismaClient();
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

  const notification = await prisma.notification.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      recipientId: recipient.id,
      actorId: input.actorId,
      appId: input.appId,
      recordId: input.recordId,
      type: assertNotificationType(input.type),
      title: assertNonEmpty(input.title, "通知タイトル"),
      body: input.body?.trim() || undefined,
      href: input.href?.trim() || undefined,
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
    notifications.push(await createNotification(user, input));
  }

  return notifications;
}

export async function listNotificationsForUser(
  user: User,
  options: ListNotificationsOptions = {}
) {
  await requirePermission(user, "notifications:read");

  const prisma = getPrismaClient();
  const notifications = await prisma.notification.findMany({
    where: {
      tenantId: user.tenantId,
      recipientId: user.id,
      ...(options.unreadOnly ? { readAt: null } : {}),
    },
    include: notificationInclude(),
    orderBy: [{ createdAt: "desc" }],
    take: normalizeLimit(options.limit),
  });

  return notifications.map(toNotification);
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
      readAt: null,
    },
    data: { readAt: new Date() },
  });
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

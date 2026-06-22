import { AppsServiceError } from "@/server/apps/service";
import { requirePermission } from "@/server/admin/rbac";
import { ensureDemoAuthData } from "@/server/auth/bootstrap";
import { recordAuditLog } from "@/server/audit/service";
import { getPrismaClient } from "@/server/db/prisma";
import type { User } from "@/types/user";

export interface AdminUserSummary {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  status: "active" | "inactive";
  lastLoginAt?: string;
  createdAt: string;
  appCount: number;
  recordCount: number;
}

function toAdminUserSummary(user: {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: "active" | "inactive";
  lastLoginAt: Date | null;
  createdAt: Date;
  _count: { createdApps: number; createdRecords: number };
}): AdminUserSummary {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? undefined,
    status: user.status,
    lastLoginAt: user.lastLoginAt?.toISOString(),
    createdAt: user.createdAt.toISOString(),
    appCount: user._count.createdApps,
    recordCount: user._count.createdRecords,
  };
}

export async function listUsersForAdmin(user: User) {
  await ensureDemoAuthData();
  await requirePermission(user, "admin:users");

  const prisma = getPrismaClient();
  const users = await prisma.user.findMany({
    where: { tenantId: user.tenantId },
    include: {
      _count: {
        select: { createdApps: true, createdRecords: true },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  return users.map(toAdminUserSummary);
}

export async function updateUserStatusForAdmin(
  user: User,
  targetUserId: string,
  status: "active" | "inactive"
) {
  await ensureDemoAuthData();
  await requirePermission(user, "admin:users");

  if (status !== "active" && status !== "inactive") {
    throw new AppsServiceError("ステータスの指定が不正です。", 400);
  }

  if (targetUserId === user.id && status === "inactive") {
    throw new AppsServiceError("自分自身を無効化することはできません。", 400);
  }

  const prisma = getPrismaClient();
  const targetUser = await prisma.user.findFirst({
    where: { id: targetUserId, tenantId: user.tenantId },
  });

  if (!targetUser) {
    throw new AppsServiceError("ユーザーが見つかりません。", 404);
  }

  const updated = await prisma.user.update({
    where: { id: targetUser.id },
    data: { status },
    include: {
      _count: {
        select: { createdApps: true, createdRecords: true },
      },
    },
  });

  if (status === "inactive") {
    await prisma.session.deleteMany({
      where: { userId: targetUser.id },
    });
  }

  await recordAuditLog(user, {
    actionType: "USER_STATUS_UPDATE",
    resourceType: "user",
    resourceId: targetUser.id,
    resourceName: targetUser.name,
    detailJson: {
      before: targetUser.status,
      after: status,
    },
  });

  return toAdminUserSummary(updated);
}

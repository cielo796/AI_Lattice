import { AppsServiceError } from "@/server/apps/service";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/server/admin/rbac";
import { hashPassword } from "@/server/auth/crypto";
import { validateDisplayName, validateEmail, validateNewPassword } from "@/server/auth/validation";
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

export interface CreateAdminUserInput {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  roleId?: unknown;
}

export async function createUserForAdmin(user: User, input: CreateAdminUserInput) {
  await requirePermission(user, "admin:users");
  await requirePermission(user, "admin:roles");
  const name = validateDisplayName(input?.name);
  const email = validateEmail(input?.email);
  const password = validateNewPassword(input?.password);
  if (typeof input?.roleId !== "string" || !input.roleId) {
    throw new AppsServiceError("ロールを選択してください。", 400);
  }

  const prisma = getPrismaClient();
  const role = await prisma.role.findFirst({ where: { id: input.roleId, tenantId: user.tenantId } });
  if (!role) {
    throw new AppsServiceError("ロールが見つかりません。", 404);
  }
  const passwordHash = await hashPassword(password);

  try {
    const created = await prisma.$transaction(async (transaction) => {
      const member = await transaction.user.create({
        data: { tenantId: user.tenantId, name, email, passwordHash },
        include: { _count: { select: { createdApps: true, createdRecords: true } } },
      });
      await transaction.userRole.create({
        data: { tenantId: user.tenantId, userId: member.id, roleId: role.id, createdById: user.id },
      });
      await transaction.auditLog.create({
        data: {
          tenantId: user.tenantId, actorId: user.id, actorName: user.name,
          actionType: "USER_CREATE", resourceType: "user", resourceId: member.id,
          resourceName: name, detailJson: { roleId: role.id },
        },
      });
      return member;
    });
    return toAdminUserSummary(created);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppsServiceError("このメールアドレスは既に登録されています。", 409);
    }
    throw error;
  }
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

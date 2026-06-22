import { Prisma } from "@prisma/client";
import { recordAuditLog } from "@/server/audit/service";
import { ensureDemoAuthData } from "@/server/auth/bootstrap";
import { getPrismaClient } from "@/server/db/prisma";
import { ServiceError } from "@/server/errors/service-error";
import type { Role, User, UserRoleAssignment } from "@/types/user";

export const PERMISSIONS = [
  "admin:users",
  "admin:roles",
  "admin:tenant",
  "admin:prompt_templates",
  "admin:audit_logs",
  "admin:ai_logs",
  "admin:openai",
  "app:read",
  "app:write",
  "app:publish",
  "app:delete",
  "table:read",
  "table:write",
  "record:read",
  "record:write",
  "workflow:read",
  "workflow:manage",
  "approval:manage",
  "ai:execute",
  "notifications:read",
  "notifications:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "admin:users": "ユーザー管理",
  "admin:roles": "ロール管理",
  "admin:tenant": "テナント設定",
  "admin:prompt_templates": "Prompt Template 管理",
  "admin:audit_logs": "監査ログ",
  "admin:ai_logs": "AI実行ログ",
  "admin:openai": "OpenAI 設定",
  "app:read": "アプリ閲覧",
  "app:write": "アプリ編集",
  "app:publish": "アプリ公開",
  "app:delete": "アプリ削除",
  "table:read": "テーブル閲覧",
  "table:write": "テーブル編集",
  "record:read": "レコード閲覧",
  "record:write": "レコード編集",
  "workflow:read": "Workflow 閲覧",
  "workflow:manage": "Workflow 管理",
  "approval:manage": "承認操作",
  "ai:execute": "AI 実行",
  "notifications:read": "通知閲覧",
  "notifications:manage": "通知管理",
};

const ROLE_PRESETS = [
  {
    name: "Tenant Admin",
    roleType: "tenant_admin" as const,
    permissions: ["*"],
    isSystem: true,
  },
  {
    name: "App Admin",
    roleType: "app_admin" as const,
    permissions: [
      "app:read",
      "app:write",
      "app:publish",
      "table:read",
      "table:write",
      "record:read",
      "record:write",
      "workflow:read",
      "workflow:manage",
      "approval:manage",
      "ai:execute",
      "notifications:read",
    ],
    isSystem: true,
  },
  {
    name: "Approver",
    roleType: "approver" as const,
    permissions: [
      "app:read",
      "table:read",
      "record:read",
      "approval:manage",
      "notifications:read",
    ],
    isSystem: true,
  },
  {
    name: "User",
    roleType: "user" as const,
    permissions: [
      "app:read",
      "table:read",
      "record:read",
      "record:write",
      "workflow:read",
      "ai:execute",
      "notifications:read",
    ],
    isSystem: true,
  },
  {
    name: "Viewer",
    roleType: "viewer" as const,
    permissions: ["app:read", "table:read", "record:read", "notifications:read"],
    isSystem: true,
  },
] satisfies Array<{
  name: string;
  roleType: Role["roleType"];
  permissions: string[];
  isSystem: boolean;
}>;

export interface CreateRoleInput {
  name: string;
  roleType: Role["roleType"];
  permissions: string[];
}

export interface UpdateRoleInput {
  name?: string;
  roleType?: Role["roleType"];
  permissions?: string[];
}

export interface AssignRoleInput {
  userId: string;
  roleId: string;
  appId?: string;
  tableId?: string;
}

export interface PermissionScope {
  appId?: string;
  tableId?: string;
}

function assertNonEmpty(value: string | undefined, fieldName: string) {
  if (!value || !value.trim()) {
    throw new ServiceError(`${fieldName}は必須です。`, 400);
  }

  return value.trim();
}

function toPermissionsJson(permissions: string[]) {
  return [...new Set(permissions)].filter((permission) => {
    return permission === "*" || PERMISSIONS.includes(permission as Permission);
  }) as Prisma.InputJsonArray;
}

function permissionsFromJson(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((permission): permission is string => typeof permission === "string");
}

function roleTypeIsValid(value: string | undefined): value is Role["roleType"] {
  return (
    value === "system_admin" ||
    value === "tenant_admin" ||
    value === "app_admin" ||
    value === "approver" ||
    value === "user" ||
    value === "viewer"
  );
}

function assertRoleType(value: string | undefined) {
  if (!roleTypeIsValid(value)) {
    throw new ServiceError("ロール種別が不正です。", 400);
  }

  return value;
}

function normalizePermissions(permissions: string[] | undefined) {
  if (!Array.isArray(permissions)) {
    throw new ServiceError("権限の指定が不正です。", 400);
  }

  const normalized = [...new Set(permissions)].filter((permission) => {
    return permission === "*" || PERMISSIONS.includes(permission as Permission);
  });

  if (normalized.length === 0) {
    throw new ServiceError("権限を1つ以上選択してください。", 400);
  }

  return normalized;
}

function toRole(role: {
  id: string;
  tenantId: string;
  name: string;
  roleType: Role["roleType"];
  permissionsJson: Prisma.JsonValue;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { assignments: number };
}): Role {
  return {
    id: role.id,
    tenantId: role.tenantId,
    name: role.name,
    roleType: role.roleType,
    permissions: permissionsFromJson(role.permissionsJson),
    isSystem: role.isSystem,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
    assignmentCount: role._count?.assignments,
  };
}

function toAssignment(assignment: {
  id: string;
  tenantId: string;
  userId: string;
  roleId: string;
  appId: string | null;
  tableId: string | null;
  createdById: string | null;
  createdAt: Date;
  user?: { name: string; email: string } | null;
  role?: { name: string; roleType: Role["roleType"] } | null;
  app?: { name: string } | null;
  table?: { name: string } | null;
}): UserRoleAssignment {
  return {
    id: assignment.id,
    tenantId: assignment.tenantId,
    userId: assignment.userId,
    userName: assignment.user?.name,
    userEmail: assignment.user?.email,
    roleId: assignment.roleId,
    roleName: assignment.role?.name,
    roleType: assignment.role?.roleType,
    appId: assignment.appId ?? undefined,
    appName: assignment.app?.name,
    tableId: assignment.tableId ?? undefined,
    tableName: assignment.table?.name,
    createdBy: assignment.createdById ?? undefined,
    createdAt: assignment.createdAt.toISOString(),
  };
}

export async function ensureDefaultRolesForTenant(tenantId: string) {
  const prisma = getPrismaClient();

  for (const preset of ROLE_PRESETS) {
    await prisma.role.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: preset.name,
        },
      },
      update: {
        roleType: preset.roleType,
        permissionsJson: toPermissionsJson(preset.permissions),
        isSystem: preset.isSystem,
      },
      create: {
        id: crypto.randomUUID(),
        tenantId,
        name: preset.name,
        roleType: preset.roleType,
        permissionsJson: toPermissionsJson(preset.permissions),
        isSystem: preset.isSystem,
      },
    });
  }
}

async function findUserRoleAssignments(user: Pick<User, "id" | "tenantId">) {
  const prisma = getPrismaClient();
  const userRoleDelegate = (
    prisma as unknown as {
      userRole?: {
        findMany: (args: unknown) => Promise<
          Array<{
            appId: string | null;
            tableId: string | null;
            role: { roleType: Role["roleType"]; permissionsJson: Prisma.JsonValue };
          }>
        >;
      };
    }
  ).userRole;

  if (!userRoleDelegate) {
    return null;
  }

  return userRoleDelegate.findMany({
    where: {
      tenantId: user.tenantId,
      userId: user.id,
    },
    include: {
      role: { select: { roleType: true, permissionsJson: true } },
    },
  });
}

function scopeMatches(
  assignment: { appId: string | null; tableId: string | null },
  scope: PermissionScope | undefined
) {
  if (!assignment.appId && !assignment.tableId) {
    return true;
  }

  if (assignment.appId && assignment.appId !== scope?.appId) {
    return false;
  }

  if (assignment.tableId && assignment.tableId !== scope?.tableId) {
    return false;
  }

  return true;
}

export async function hasPermission(
  user: Pick<User, "id" | "tenantId">,
  permission: Permission,
  scope?: PermissionScope
) {
  const assignments = await findUserRoleAssignments(user);

  if (assignments === null) {
    return true;
  }

  if (assignments.length === 0) {
    return false;
  }

  return assignments.some((assignment) => {
    if (!scopeMatches(assignment, scope)) {
      return false;
    }

    const permissions = permissionsFromJson(assignment.role.permissionsJson);
    return permissions.includes("*") || permissions.includes(permission);
  });
}

export async function requirePermission(
  user: Pick<User, "id" | "tenantId">,
  permission: Permission,
  scope?: PermissionScope
) {
  if (await hasPermission(user, permission, scope)) {
    return;
  }

  throw new ServiceError("この操作を行う権限がありません。", 403);
}

export async function listRolesForAdmin(user: User) {
  await ensureDemoAuthData();
  await ensureDefaultRolesForTenant(user.tenantId);
  await requirePermission(user, "admin:roles");

  const prisma = getPrismaClient();
  const roles = await prisma.role.findMany({
    where: { tenantId: user.tenantId },
    include: { _count: { select: { assignments: true } } },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  return roles.map((role) => toRole(role as typeof role & { roleType: Role["roleType"] }));
}

export async function createRoleForAdmin(user: User, input: CreateRoleInput) {
  await ensureDemoAuthData();
  await ensureDefaultRolesForTenant(user.tenantId);
  await requirePermission(user, "admin:roles");

  const name = assertNonEmpty(input.name, "ロール名");
  const roleType = assertRoleType(input.roleType);
  const permissions = normalizePermissions(input.permissions);
  const prisma = getPrismaClient();
  const role = await prisma.role.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      name,
      roleType,
      permissionsJson: toPermissionsJson(permissions),
      isSystem: false,
    },
    include: { _count: { select: { assignments: true } } },
  });

  await recordAuditLog(user, {
    actionType: "ROLE_CREATE",
    resourceType: "role",
    resourceId: role.id,
    resourceName: role.name,
    detailJson: { roleType, permissions },
  });

  return toRole(role as typeof role & { roleType: Role["roleType"] });
}

export async function updateRoleForAdmin(
  user: User,
  roleId: string,
  input: UpdateRoleInput
) {
  await ensureDemoAuthData();
  await ensureDefaultRolesForTenant(user.tenantId);
  await requirePermission(user, "admin:roles");

  const prisma = getPrismaClient();
  const existing = await prisma.role.findFirst({
    where: { id: roleId, tenantId: user.tenantId },
  });

  if (!existing) {
    throw new ServiceError("ロールが見つかりません。", 404);
  }

  const nextName = input.name?.trim() || existing.name;
  const nextRoleType =
    input.roleType !== undefined ? assertRoleType(input.roleType) : existing.roleType;
  const nextPermissions =
    input.permissions !== undefined
      ? normalizePermissions(input.permissions)
      : permissionsFromJson(existing.permissionsJson);

  const role = await prisma.role.update({
    where: { id: existing.id },
    data: {
      name: nextName,
      roleType: nextRoleType,
      permissionsJson: toPermissionsJson(nextPermissions),
    },
    include: { _count: { select: { assignments: true } } },
  });

  await recordAuditLog(user, {
    actionType: "ROLE_UPDATE",
    resourceType: "role",
    resourceId: role.id,
    resourceName: role.name,
    detailJson: {
      before: {
        name: existing.name,
        roleType: existing.roleType,
        permissions: permissionsFromJson(existing.permissionsJson),
      },
      after: {
        name: role.name,
        roleType: role.roleType,
        permissions: nextPermissions,
      },
    },
  });

  return toRole(role as typeof role & { roleType: Role["roleType"] });
}

export async function deleteRoleForAdmin(user: User, roleId: string) {
  await ensureDemoAuthData();
  await requirePermission(user, "admin:roles");

  const prisma = getPrismaClient();
  const existing = await prisma.role.findFirst({
    where: { id: roleId, tenantId: user.tenantId },
    include: { _count: { select: { assignments: true } } },
  });

  if (!existing) {
    throw new ServiceError("ロールが見つかりません。", 404);
  }

  if (existing.isSystem) {
    throw new ServiceError("システムロールは削除できません。", 400);
  }

  if (existing._count.assignments > 0) {
    throw new ServiceError("割り当て済みのロールは削除できません。", 409);
  }

  await prisma.role.delete({ where: { id: existing.id } });

  await recordAuditLog(user, {
    actionType: "ROLE_DELETE",
    resourceType: "role",
    resourceId: existing.id,
    resourceName: existing.name,
  });
}

export async function listRoleAssignmentsForAdmin(user: User) {
  await ensureDemoAuthData();
  await ensureDefaultRolesForTenant(user.tenantId);
  await requirePermission(user, "admin:roles");

  const prisma = getPrismaClient();
  const assignments = await prisma.userRole.findMany({
    where: { tenantId: user.tenantId },
    include: {
      user: { select: { name: true, email: true } },
      role: { select: { name: true, roleType: true } },
      app: { select: { name: true } },
      table: { select: { name: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return assignments.map((assignment) =>
    toAssignment(assignment as typeof assignment & { role: { name: string; roleType: Role["roleType"] } })
  );
}

export async function assignRoleForAdmin(user: User, input: AssignRoleInput) {
  await ensureDemoAuthData();
  await ensureDefaultRolesForTenant(user.tenantId);
  await requirePermission(user, "admin:roles");

  const targetUserId = assertNonEmpty(input.userId, "ユーザー");
  const roleId = assertNonEmpty(input.roleId, "ロール");
  const prisma = getPrismaClient();
  const [targetUser, role] = await Promise.all([
    prisma.user.findFirst({ where: { id: targetUserId, tenantId: user.tenantId } }),
    prisma.role.findFirst({ where: { id: roleId, tenantId: user.tenantId } }),
  ]);

  if (!targetUser || !role) {
    throw new ServiceError("ユーザーまたはロールが見つかりません。", 404);
  }

  const existing = await prisma.userRole.findFirst({
    where: {
      tenantId: user.tenantId,
      userId: targetUser.id,
      roleId: role.id,
      appId: input.appId ?? null,
      tableId: input.tableId ?? null,
    },
  });

  if (existing) {
    throw new ServiceError("同じロール割り当てが既に存在します。", 409);
  }

  const assignment = await prisma.userRole.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      userId: targetUser.id,
      roleId: role.id,
      appId: input.appId,
      tableId: input.tableId,
      createdById: user.id,
    },
    include: {
      user: { select: { name: true, email: true } },
      role: { select: { name: true, roleType: true } },
      app: { select: { name: true } },
      table: { select: { name: true } },
    },
  });

  await recordAuditLog(user, {
    actionType: "USER_ROLE_ASSIGN",
    resourceType: "user_role",
    resourceId: assignment.id,
    resourceName: `${targetUser.name} / ${role.name}`,
    detailJson: {
      userId: targetUser.id,
      roleId: role.id,
      appId: assignment.appId,
      tableId: assignment.tableId,
    },
  });

  return toAssignment(
    assignment as typeof assignment & { role: { name: string; roleType: Role["roleType"] } }
  );
}

export async function revokeRoleAssignmentForAdmin(
  user: User,
  assignmentId: string
) {
  await ensureDemoAuthData();
  await requirePermission(user, "admin:roles");

  const prisma = getPrismaClient();
  const assignment = await prisma.userRole.findFirst({
    where: { id: assignmentId, tenantId: user.tenantId },
    include: {
      user: { select: { name: true } },
      role: { select: { name: true } },
    },
  });

  if (!assignment) {
    throw new ServiceError("ロール割り当てが見つかりません。", 404);
  }

  if (assignment.userId === user.id) {
    const ownAssignments = await prisma.userRole.count({
      where: { tenantId: user.tenantId, userId: user.id },
    });

    if (ownAssignments <= 1) {
      throw new ServiceError("最後の自分のロールは解除できません。", 400);
    }
  }

  await prisma.userRole.delete({ where: { id: assignment.id } });

  await recordAuditLog(user, {
    actionType: "USER_ROLE_REVOKE",
    resourceType: "user_role",
    resourceId: assignment.id,
    resourceName: `${assignment.user?.name ?? assignment.userId} / ${assignment.role?.name ?? assignment.roleId}`,
  });
}

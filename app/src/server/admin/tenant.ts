import { AppsServiceError } from "@/server/apps/service";
import { recordAuditLog } from "@/server/audit/service";
import { ensureDemoAuthData } from "@/server/auth/bootstrap";
import { getPrismaClient } from "@/server/db/prisma";
import { requirePermission } from "@/server/admin/rbac";
import type { Tenant, User } from "@/types/user";

export interface UpdateTenantInput {
  name?: string;
  code?: string;
  status?: Tenant["status"];
  planType?: string;
}

function toTenant(tenant: {
  id: string;
  name: string;
  code: string;
  status: Tenant["status"];
  planType: string;
  createdAt: Date;
  updatedAt: Date;
}): Tenant {
  return {
    id: tenant.id,
    name: tenant.name,
    code: tenant.code,
    status: tenant.status,
    planType: tenant.planType,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
  };
}

function normalizeCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function assertTenantStatus(value: string | undefined) {
  if (value !== "active" && value !== "inactive") {
    throw new AppsServiceError("テナントステータスが不正です。", 400);
  }

  return value;
}

export async function getCurrentTenant(user: Pick<User, "tenantId">) {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
  });

  if (!tenant) {
    throw new AppsServiceError("テナントが見つかりません。", 404);
  }

  return toTenant(tenant as typeof tenant & { status: Tenant["status"] });
}

export async function getTenantForAdmin(user: User) {
  await ensureDemoAuthData();
  await requirePermission(user, "admin:tenant");

  return getCurrentTenant(user);
}

export async function updateTenantForAdmin(user: User, input: UpdateTenantInput) {
  await ensureDemoAuthData();
  await requirePermission(user, "admin:tenant");

  const prisma = getPrismaClient();
  const existing = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
  });

  if (!existing) {
    throw new AppsServiceError("テナントが見つかりません。", 404);
  }

  const nextCode =
    input.code !== undefined ? normalizeCode(input.code) : existing.code;

  if (!nextCode) {
    throw new AppsServiceError("テナントコードは必須です。", 400);
  }

  const tenant = await prisma.tenant.update({
    where: { id: existing.id },
    data: {
      name: input.name?.trim() || existing.name,
      code: nextCode,
      status:
        input.status !== undefined
          ? assertTenantStatus(input.status)
          : existing.status,
      planType: input.planType?.trim() || existing.planType,
    },
  });

  await recordAuditLog(user, {
    actionType: "TENANT_UPDATE",
    resourceType: "tenant",
    resourceId: tenant.id,
    resourceName: tenant.name,
    detailJson: {
      before: {
        name: existing.name,
        code: existing.code,
        status: existing.status,
        planType: existing.planType,
      },
      after: {
        name: tenant.name,
        code: tenant.code,
        status: tenant.status,
        planType: tenant.planType,
      },
    },
  });

  return toTenant(tenant as typeof tenant & { status: Tenant["status"] });
}

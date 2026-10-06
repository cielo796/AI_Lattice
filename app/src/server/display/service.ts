import { hasPermission, requirePermission } from "@/server/admin/rbac";
import { recordAuditLog } from "@/server/audit/service";
import { getCurrentSession } from "@/server/auth/session";
import { getPrismaClient } from "@/server/db/prisma";
import { isDatabaseSetupError } from "@/server/db/setup-errors";
import { ServiceError } from "@/server/errors/service-error";
import { defaultDisplaySettings, isDisplayPreference, isTenantTheme, type DisplaySettings } from "@/lib/display-theme";
import type { User } from "@/types/user";

export async function getDisplaySettings(user: Pick<User, "id" | "tenantId">): Promise<DisplaySettings> {
  const profile = await getPrismaClient().user.findFirst({
    where: { id: user.id, tenantId: user.tenantId },
    select: { displayTheme: true, tenant: { select: { defaultTheme: true, allowUserTheme: true } } },
  });
  if (!profile) throw new ServiceError("ユーザーが見つかりません。", 404);
  return {
    preference: isDisplayPreference(profile.displayTheme) ? profile.displayTheme : null,
    defaultTheme: isTenantTheme(profile.tenant.defaultTheme) ? profile.tenant.defaultTheme : "navy",
    allowUserTheme: profile.tenant.allowUserTheme,
    canManageTenant: await hasPermission(user, "admin:tenant"),
  };
}

export async function getInitialDisplaySettings() {
  try {
    const session = await getCurrentSession();
    return session ? await getDisplaySettings(session.user) : defaultDisplaySettings;
  } catch (error) {
    if (isDatabaseSetupError(error)) return defaultDisplaySettings;
    throw error;
  }
}

export async function updateDisplaySettings(user: User, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ServiceError("表示設定が不正です。", 400);
  }
  const values = input as Record<string, unknown>;
  const keys = Object.keys(values);
  const personal = keys.length === 1 && keys[0] === "preference";
  const tenant = keys.length > 0 && keys.every((key) => key === "defaultTheme" || key === "allowUserTheme");
  if (!personal && !tenant) throw new ServiceError("表示設定の項目が不正です。", 400);

  if (personal) {
    if (values.preference !== null && !isDisplayPreference(values.preference)) {
      throw new ServiceError("表示テーマが不正です。", 400);
    }
    const result = await getPrismaClient().user.updateMany({
      where: { id: user.id, tenantId: user.tenantId, tenant: { allowUserTheme: true } },
      data: { displayTheme: values.preference as string | null },
    });
    if (!result.count) throw new ServiceError("テナント管理者が表示の変更を禁止しています。", 403);
  } else {
    await requirePermission(user, "admin:tenant");
    if ("defaultTheme" in values && !isTenantTheme(values.defaultTheme)) {
      throw new ServiceError("テナントの既定はネイビーまたはホワイトです。", 400);
    }
    if ("allowUserTheme" in values && typeof values.allowUserTheme !== "boolean") {
      throw new ServiceError("ユーザー変更許可が不正です。", 400);
    }
    await getPrismaClient().tenant.update({
      where: { id: user.tenantId },
      data: {
        ...("defaultTheme" in values ? { defaultTheme: values.defaultTheme as string } : {}),
        ...("allowUserTheme" in values ? { allowUserTheme: values.allowUserTheme as boolean } : {}),
      },
    });
  }
  await recordAuditLog(user, {
    actionType: personal ? "DISPLAY_PREFERENCE_UPDATE" : "TENANT_DISPLAY_UPDATE",
    resourceType: personal ? "user" : "tenant",
    resourceId: personal ? user.id : user.tenantId,
    detailJson: values,
  });
  return getDisplaySettings(user);
}

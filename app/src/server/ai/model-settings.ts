import { requirePermission } from "@/server/admin/rbac";
import { recordAuditLog } from "@/server/audit/service";
import { getPrismaClient } from "@/server/db/prisma";
import { AppsServiceError } from "@/server/apps/service";
import { AI_MODEL_CATALOG_VERIFIED_AT, AI_MODEL_OPTIONS, DEFAULT_AI_MODEL, isKnownAIModel } from "@/lib/ai-models";
import type { AIModelSettings } from "@/types/settings";
import type { User } from "@/types/user";

type SettingsUser = Pick<User, "id" | "tenantId" | "name" | "email">;

function toModelSettings(model: string | undefined): AIModelSettings {
  return {
    defaultModel: model ?? DEFAULT_AI_MODEL,
    source: model ? "tenant" : "default",
    models: AI_MODEL_OPTIONS,
    catalogVerifiedAt: AI_MODEL_CATALOG_VERIFIED_AT,
  };
}

export async function getTenantAIModel(tenantId: string) {
  const settings = await getPrismaClient().tenantAIModelSettings.findUnique({ where: { tenantId } });
  return settings?.defaultModel ?? DEFAULT_AI_MODEL;
}

export async function getAIModelSettings(user: Pick<User, "id" | "tenantId">): Promise<AIModelSettings> {
  await requirePermission(user, "admin:openai");
  const settings = await getPrismaClient().tenantAIModelSettings.findUnique({ where: { tenantId: user.tenantId } });
  return toModelSettings(settings?.defaultModel);
}

export async function saveAIModelSettings(user: SettingsUser, input: unknown): Promise<AIModelSettings> {
  await requirePermission(user, "admin:openai");
  if (!input || typeof input !== "object" || !("defaultModel" in input) || !isKnownAIModel(input.defaultModel)) {
    throw new AppsServiceError("選択可能なAIモデルを指定してください", 400);
  }
  const defaultModel = input.defaultModel;
  const settings = await getPrismaClient().$transaction(async (transaction) => {
    const previous = await transaction.tenantAIModelSettings.findUnique({ where: { tenantId: user.tenantId } });
    const saved = await transaction.tenantAIModelSettings.upsert({
      where: { tenantId: user.tenantId },
      create: { tenantId: user.tenantId, defaultModel },
      update: { defaultModel },
    });
    await recordAuditLog(user, {
      actionType: "AI_MODEL_SETTINGS_UPDATE", resourceType: "ai_settings", resourceId: saved.id,
      resourceName: "AI default model",
      detailJson: { before: previous?.defaultModel ?? DEFAULT_AI_MODEL, after: defaultModel },
    }, transaction);
    return saved;
  });
  return toModelSettings(settings.defaultModel);
}

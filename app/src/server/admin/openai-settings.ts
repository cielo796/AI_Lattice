import { getPrismaClient } from "@/server/db/prisma";
import { AppsServiceError } from "@/server/apps/service";
import { decryptSecret, encryptSecret } from "@/server/secrets/encryption";
import { recordAuditLog } from "@/server/audit/service";
import type { OpenAISettingsStatus } from "@/types/settings";
import type { User } from "@/types/user";

const MIN_OPENAI_API_KEY_LENGTH = 20;

interface SaveOpenAISettingsInput {
  apiKey?: unknown;
}

function getEnvironmentApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

function getLastFour(value: string) {
  return value.slice(-4);
}

function maskApiKey(lastFour: string) {
  return `**** ${lastFour}`;
}

function normalizeApiKey(value: unknown) {
  if (typeof value !== "string") {
    throw new AppsServiceError("OpenAI API キーを入力してください", 400);
  }

  const apiKey = value.trim();

  if (!apiKey) {
    throw new AppsServiceError("OpenAI API キーを入力してください", 400);
  }

  if (!apiKey.startsWith("sk-") || apiKey.length < MIN_OPENAI_API_KEY_LENGTH) {
    throw new AppsServiceError("OpenAI API キーの形式が不正です", 400);
  }

  return apiKey;
}

export async function getTenantOpenAIApiKey(tenantId: string) {
  const prisma = getPrismaClient();
  const settings = await prisma.tenantOpenAISettings.findUnique({
    where: { tenantId },
  });

  if (!settings) {
    return null;
  }

  return decryptSecret(settings.apiKeyEncrypted);
}

export async function getOpenAISettingsStatus(
  user: Pick<User, "tenantId">
): Promise<OpenAISettingsStatus> {
  const prisma = getPrismaClient();
  const settings = await prisma.tenantOpenAISettings.findUnique({
    where: { tenantId: user.tenantId },
  });
  const environmentApiKey = getEnvironmentApiKey();
  const environmentFallbackConfigured = Boolean(environmentApiKey);

  if (settings) {
    return {
      configured: true,
      source: "tenant",
      lastFour: settings.apiKeyLastFour,
      maskedApiKey: maskApiKey(settings.apiKeyLastFour),
      updatedAt: settings.updatedAt.toISOString(),
      environmentFallbackConfigured,
    };
  }

  if (environmentApiKey) {
    const lastFour = getLastFour(environmentApiKey);

    return {
      configured: true,
      source: "environment",
      lastFour,
      maskedApiKey: maskApiKey(lastFour),
      environmentFallbackConfigured,
    };
  }

  return {
    configured: false,
    source: "none",
    environmentFallbackConfigured,
  };
}

export async function saveOpenAISettings(
  user: Pick<User, "id" | "tenantId" | "name" | "email">,
  input: SaveOpenAISettingsInput
) {
  const apiKey = normalizeApiKey(input.apiKey);
  const lastFour = getLastFour(apiKey);
  const prisma = getPrismaClient();

  const settings = await prisma.tenantOpenAISettings.upsert({
    where: { tenantId: user.tenantId },
    update: {
      apiKeyEncrypted: encryptSecret(apiKey),
      apiKeyLastFour: lastFour,
    },
    create: {
      tenantId: user.tenantId,
      apiKeyEncrypted: encryptSecret(apiKey),
      apiKeyLastFour: lastFour,
    },
  });

  await recordAuditLog(user, {
    actionType: "OPENAI_API_KEY_UPDATE",
    resourceType: "ai_settings",
    resourceId: settings.id,
    resourceName: "OpenAI API key",
    detailJson: {
      source: "tenant",
      lastFour,
    },
  });

  return getOpenAISettingsStatus(user);
}

export async function clearOpenAISettings(
  user: Pick<User, "id" | "tenantId" | "name" | "email">
) {
  const prisma = getPrismaClient();
  const existing = await prisma.tenantOpenAISettings.findUnique({
    where: { tenantId: user.tenantId },
  });

  if (existing) {
    await prisma.tenantOpenAISettings.delete({
      where: { tenantId: user.tenantId },
    });
  }

  await recordAuditLog(user, {
    actionType: "OPENAI_API_KEY_CLEAR",
    resourceType: "ai_settings",
    resourceId: existing?.id,
    resourceName: "OpenAI API key",
    detailJson: {
      source: existing ? "tenant" : "none",
    },
  });

  return getOpenAISettingsStatus(user);
}

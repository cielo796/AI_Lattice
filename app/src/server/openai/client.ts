import OpenAI from "openai";
import { AppsServiceError } from "@/server/apps/service";
import { getTenantOpenAIApiKey } from "@/server/admin/openai-settings";

const DEFAULT_OPENAI_TIMEOUT_MS = 90_000;

const cachedClients = new Map<string, OpenAI>();

function getOpenAITimeoutMs() {
  const rawTimeout = process.env.OPENAI_TIMEOUT_MS?.trim();

  if (!rawTimeout) {
    return DEFAULT_OPENAI_TIMEOUT_MS;
  }

  const timeout = Number(rawTimeout);

  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new AppsServiceError("OPENAI_TIMEOUT_MS は正の数で指定してください", 503);
  }

  return timeout;
}

function getEnvironmentOpenAIApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

function getCachedClient(apiKey: string) {
  const existingClient = cachedClients.get(apiKey);

  if (existingClient) {
    return existingClient;
  }

  const client = new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: getOpenAITimeoutMs(),
  });

  cachedClients.set(apiKey, client);
  return client;
}

export async function getOpenAIClient(tenantId?: string) {
  const tenantApiKey = tenantId ? await getTenantOpenAIApiKey(tenantId) : null;
  const apiKey = tenantApiKey ?? getEnvironmentOpenAIApiKey();

  if (!apiKey) {
    throw new AppsServiceError("OPENAI_API_KEY が設定されていません", 503);
  }

  return getCachedClient(apiKey);
}

export { DEFAULT_OPENAI_TIMEOUT_MS, getOpenAITimeoutMs };

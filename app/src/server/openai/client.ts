import OpenAI from "openai";
import { AppsServiceError } from "@/server/apps/service";

const DEFAULT_OPENAI_TIMEOUT_MS = 90_000;

let cachedClient: OpenAI | null = null;

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

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new AppsServiceError("OPENAI_API_KEY が設定されていません", 503);
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey,
      maxRetries: 0,
      timeout: getOpenAITimeoutMs(),
    });
  }

  return cachedClient;
}

export { DEFAULT_OPENAI_TIMEOUT_MS, getOpenAITimeoutMs };

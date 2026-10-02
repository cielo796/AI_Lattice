import { apiFetch } from "@/lib/api/client";
import type { AIModelSettings, OpenAISettingsStatus } from "@/types/settings";

const OPENAI_SETTINGS_PATH = "/api/admin/openai-settings";

export async function getAIModelSettings() {
  return apiFetch<AIModelSettings>("/api/admin/ai-model-settings");
}

export async function saveAIModelSettings(defaultModel: string) {
  return apiFetch<AIModelSettings>("/api/admin/ai-model-settings", {
    method: "PUT",
    body: JSON.stringify({ defaultModel }),
  });
}

export async function getOpenAISettings() {
  return apiFetch<OpenAISettingsStatus>(OPENAI_SETTINGS_PATH);
}

export async function saveOpenAISettings(apiKey: string) {
  return apiFetch<OpenAISettingsStatus>(OPENAI_SETTINGS_PATH, {
    method: "PUT",
    body: JSON.stringify({ apiKey }),
  });
}

export async function clearOpenAISettings() {
  return apiFetch<OpenAISettingsStatus>(OPENAI_SETTINGS_PATH, {
    method: "DELETE",
  });
}

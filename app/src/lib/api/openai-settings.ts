import { apiFetch } from "@/lib/api/client";
import type { OpenAISettingsStatus } from "@/types/settings";

const OPENAI_SETTINGS_PATH = "/api/admin/openai-settings";

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

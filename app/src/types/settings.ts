export type OpenAISettingsSource = "tenant" | "environment" | "none";

export interface AIModelSettings {
  defaultModel: string;
  source: "tenant" | "default";
  models: readonly { id: string; label: string; description: string }[];
  catalogVerifiedAt: string;
}

export interface OpenAISettingsStatus {
  configured: boolean;
  source: OpenAISettingsSource;
  maskedApiKey?: string;
  lastFour?: string;
  updatedAt?: string;
  environmentFallbackConfigured: boolean;
}

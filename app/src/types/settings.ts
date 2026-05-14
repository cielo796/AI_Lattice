export type OpenAISettingsSource = "tenant" | "environment" | "none";

export interface OpenAISettingsStatus {
  configured: boolean;
  source: OpenAISettingsSource;
  maskedApiKey?: string;
  lastFour?: string;
  updatedAt?: string;
  environmentFallbackConfigured: boolean;
}

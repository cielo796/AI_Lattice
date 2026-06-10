import type { FieldType } from "@/types/app";

export interface AIGeneratedApp {
  name: string;
  code: string;
  description: string;
  tables: AIGeneratedTable[];
  views: AIGeneratedView[];
  workflows: AIGeneratedWorkflow[];
  aiInsight: string;
}

export interface AIGeneratedTable {
  name: string;
  code: string;
  fields: AIGeneratedField[];
}

export interface AIGeneratedField {
  name: string;
  code: string;
  fieldType: string;
  required: boolean;
  isAISuggested?: boolean;
}

export interface AIGeneratedView {
  name: string;
  viewType: string;
}

export interface AIGeneratedWorkflow {
  name: string;
  triggerType: string;
}

export type GeneratedBlueprintFieldType = Extract<
  FieldType,
  "text" | "textarea" | "number" | "date" | "datetime" | "boolean" | "select"
>;

export interface GeneratedBlueprintField {
  name: string;
  code: string;
  fieldType: GeneratedBlueprintFieldType;
  required: boolean;
  options?: string[];
}

export interface GeneratedBlueprintTable {
  name: string;
  code: string;
  fields: GeneratedBlueprintField[];
}

export interface GeneratedAppBlueprint {
  name: string;
  code: string;
  description: string;
  aiInsight: string;
  tables: GeneratedBlueprintTable[];
}

export interface AISummary {
  summary: string;
  recommendedActions: AIRecommendedAction[];
  similarIncidents: AISimilarIncident[];
}

export interface AIRecommendedAction {
  label: string;
  description: string;
  icon: string;
  type: "escalate" | "template" | "assign" | "resolve";
}

export interface AISimilarIncident {
  id: string;
  title: string;
  matchPercentage: number;
  resolution: string;
  date: string;
}

export interface AIFieldSuggestion {
  fieldName: string;
  fieldType: string;
  reason: string;
}

export interface AIFlowHistoryItem {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
  type: "system" | "ai" | "user";
  status?: "completed" | "pending" | "proposed";
}

export interface AIExecutionLog {
  id: string;
  tenantId: string;
  appId?: string;
  appName?: string;
  appCode?: string;
  recordId?: string;
  promptTemplateVersionId?: string;
  promptTemplateKey?: string;
  promptTemplateName?: string;
  promptTemplateVersion?: number;
  actorId: string;
  actorName?: string;
  operation: string;
  provider: string;
  modelName: string;
  status: "success" | "error";
  inputJson?: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  errorMessage?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs?: number;
  createdAt: string;
}

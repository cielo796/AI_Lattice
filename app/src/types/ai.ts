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

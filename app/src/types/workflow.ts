export type WorkflowNodeType =
  | "trigger"
  | "condition"
  | "approval"
  | "notification"
  | "ai_action"
  | "status_update"
  | "api_call";

export interface WorkflowNodeData {
  label: string;
  description?: string;
  nodeType: WorkflowNodeType;
  config?: Record<string, unknown>;
  isAIProposed?: boolean;
}

export interface Workflow {
  id: string;
  tenantId: string;
  appId: string;
  name: string;
  triggerType: "create" | "update" | "schedule" | "webhook" | "status_change";
  status: "draft" | "active";
  definitionJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

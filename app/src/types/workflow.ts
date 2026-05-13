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

export interface WorkflowDefinition {
  nodes: Array<{
    id: string;
    type?: string;
    position?: { x: number; y: number };
    data: WorkflowNodeData;
    [key: string]: unknown;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    [key: string]: unknown;
  }>;
}

export interface Workflow {
  id: string;
  tenantId: string;
  appId: string;
  name: string;
  triggerType: "create" | "update" | "schedule" | "webhook" | "status_change";
  status: "draft" | "active";
  definitionJson: WorkflowDefinition;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approvalCount?: number;
  pendingApprovalCount?: number;
}

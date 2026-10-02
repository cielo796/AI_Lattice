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
  [key: string]: unknown;
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

export interface WorkflowEditorContext {
  tables: Array<{
    id: string;
    code: string;
    name: string;
    fields: Array<{ code: string; name: string; fieldType: string }>;
  }>;
  users: Array<{ id: string; name: string }>;
  approvalPolicy: { enabled: boolean; targetTableId: string | null } | null;
  allowedApiOrigins: string[];
  promptTemplates: Array<{ key: string; name: string; operation: string }>;
}

export interface WorkflowNodeExecution {
  nodeId: string;
  nodeType: WorkflowNodeType;
  status: "running" | "waiting" | "success" | "failure" | "skip";
  startedAt: string;
  finishedAt?: string;
  outcome?: string;
  approvalId?: string;
  error?: string;
}

export interface WorkflowRunState {
  queue: string[];
  executions: WorkflowNodeExecution[];
  waitingFor?: { nodeId: string; approvalId: string };
}

export interface WorkflowRun {
  id: string;
  workflowId: string | null;
  workflowName: string;
  recordId: string;
  status: "ready" | "running" | "waiting" | "interrupted" | "completed" | "failed";
  state: WorkflowRunState;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface WorkflowRecoveryInput {
  action: "retry" | "skip" | "fail";
  reason: string;
  expectedUpdatedAt: string;
  confirmExternalOutcome?: boolean;
}

export interface WorkflowScheduleInfo {
  workflowStatus: "draft" | "active";
  nextDueAt: string | null;
  cycleInProgress: boolean;
  lastBatchAt: string | null;
  lastError: string | null;
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

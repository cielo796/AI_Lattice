import { Prisma } from "@prisma/client";
import { requirePermission } from "@/server/admin/rbac";
import { AppsServiceError } from "@/server/apps/service";
import { ensureDemoBuilderData } from "@/server/apps/bootstrap";
import { recordAuditLog } from "@/server/audit/service";
import {
  executeRuntimeAIAction,
  isRuntimeAIAction,
  type RuntimeAIExecution,
} from "@/server/ai/runtime-ai";
import { getPrismaClient } from "@/server/db/prisma";
import {
  createNotification,
  createNotificationsForUsers,
  listWorkflowNotificationRecipients,
} from "@/server/notifications/service";
import type { Approval } from "@/types/record";
import type {
  Workflow,
  WorkflowDefinition,
  WorkflowNodeData,
} from "@/types/workflow";
import type { User } from "@/types/user";
import { validateWorkflowGraph, workflowEntryId } from "@/lib/workflow-graph";
import { executeSavedWorkflowRun, toWorkflowRun, workflowJson, type WorkflowNodeExecutor } from "./execution";
import { resolveApproverUsers } from "./app-approval-settings";

export class WorkflowsServiceError extends AppsServiceError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "WorkflowsServiceError";
  }
}

export interface CreateWorkflowInput {
  name: string;
  triggerType?: Workflow["triggerType"];
  status?: Workflow["status"];
  definitionJson?: WorkflowDefinition;
}

export interface UpdateWorkflowInput {
  name?: string;
  triggerType?: Workflow["triggerType"];
  status?: Workflow["status"];
  definitionJson?: WorkflowDefinition;
}

export interface CreateApprovalInput {
  workflowId?: string;
  approverId?: string;
  title?: string;
  description?: string;
}

export interface UpdateApprovalDecisionInput {
  status: "approved" | "rejected" | "returned";
  commentText?: string;
}

export interface ListApprovalsOptions {
  status?: Approval["status"];
  limit?: number;
  appId?: string;
}

export interface RunWorkflowForRecordInput {
  tableId: string;
  recordId: string;
}

export interface RunApprovalWorkflowInput {
  appId: string;
  appCode: string;
  tableId: string;
  tableCode: string;
  tableName: string;
  recordId: string;
  recordTitle: string;
  triggerTypes: Workflow["triggerType"][];
  workflowIds?: string[];
  eventKey?: string;
  failOnError?: boolean;
}

const WORKFLOW_TRIGGER_TYPES: Workflow["triggerType"][] = [
  "create",
  "update",
  "schedule",
  "webhook",
  "status_change",
];
const WORKFLOW_STATUSES: Workflow["status"][] = ["draft", "active"];
const APPROVAL_STATUSES: Approval["status"][] = [
  "pending",
  "approved",
  "rejected",
  "returned",
];
const DEFAULT_APPROVAL_LIMIT = 100;
const MAX_APPROVAL_LIMIT = 500;
const DEFAULT_PENDING_APPROVAL_STATUS = "pending_approval";
const DEFAULT_APPROVED_RECORD_STATUS = "approved";
const DEFAULT_REJECTED_RECORD_STATUS = "rejected";
const DEFAULT_RETURNED_RECORD_STATUS = "returned";

interface ApprovalNodeConfig {
  approverId?: string;
  titleTemplate?: string;
  description?: string;
  pendingStatus: string;
  approvedStatus: string;
  rejectedStatus: string;
  returnedStatus: string;
}

const DEFAULT_WORKFLOW_DEFINITION: WorkflowDefinition = {
  nodes: [
    {
      id: "wf-node-1",
      type: "triggerNode",
      position: { x: 150, y: 200 },
      data: {
        label: "Record changed",
        description: "Detect record changes that require governance.",
        nodeType: "trigger",
      },
    },
    {
      id: "wf-node-2",
      type: "conditionNode",
      position: { x: 500, y: 200 },
      data: {
        label: "Approval required",
        description: "Route important record changes through an approval gate.",
        nodeType: "condition",
      },
    },
    {
      id: "wf-node-3",
      type: "approvalNode",
      position: { x: 850, y: 120 },
      data: {
        label: "Manager approval",
        description: "Create a pending approval before the record moves forward.",
        nodeType: "approval",
        config: {
          titleTemplate: "{{recordTitle}} approval",
          description: "Review this record before it can move forward.",
          pendingStatus: DEFAULT_PENDING_APPROVAL_STATUS,
          approvedStatus: DEFAULT_APPROVED_RECORD_STATUS,
          rejectedStatus: DEFAULT_REJECTED_RECORD_STATUS,
          returnedStatus: DEFAULT_RETURNED_RECORD_STATUS,
        },
        isAIProposed: true,
      },
    },
    {
      id: "wf-node-4",
      type: "notificationNode",
      position: { x: 850, y: 300 },
      data: {
        label: "Notify stakeholders",
        description: "Notify related users after the approval decision.",
        nodeType: "notification",
      },
    },
  ],
  edges: [
    {
      id: "wf-edge-1",
      source: "wf-node-1",
      target: "wf-node-2",
      animated: true,
      style: { stroke: "#475569", strokeWidth: 2, strokeDasharray: "8 4" },
    },
    {
      id: "wf-edge-2",
      source: "wf-node-2",
      target: "wf-node-3",
      label: "yes",
      animated: true,
      style: { stroke: "#10b981", strokeWidth: 2 },
    },
    {
      id: "wf-edge-3",
      source: "wf-node-2",
      target: "wf-node-4",
      label: "no",
      style: { stroke: "#475569", strokeWidth: 2, strokeDasharray: "8 4" },
    },
    { id: "wf-edge-4", source: "wf-node-3", target: "wf-node-4" },
  ],
};

function assertNonEmpty(value: string | undefined, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new WorkflowsServiceError(`${fieldName} is required`, 400);
  }

  return value.trim();
}

function assertWorkflowTriggerType(value: string | undefined) {
  const triggerType = value ?? "update";

  if (!WORKFLOW_TRIGGER_TYPES.includes(triggerType as Workflow["triggerType"])) {
    throw new WorkflowsServiceError("Workflow trigger type is invalid", 400);
  }

  return triggerType as Workflow["triggerType"];
}

function assertWorkflowStatus(value: string | undefined) {
  const status = value ?? "draft";

  if (!WORKFLOW_STATUSES.includes(status as Workflow["status"])) {
    throw new WorkflowsServiceError("Workflow status is invalid", 400);
  }

  return status as Workflow["status"];
}

function assertApprovalStatus(value: string | undefined) {
  if (!APPROVAL_STATUSES.includes(value as Approval["status"])) {
    throw new WorkflowsServiceError("Approval status is invalid", 400);
  }

  return value as Approval["status"];
}

function assertApprovalDecisionStatus(value: string | undefined) {
  const status = assertApprovalStatus(value);

  if (status === "pending") {
    throw new WorkflowsServiceError(
      "Approval decision must be approved, rejected, or returned",
      400
    );
  }

  return status as Exclude<Approval["status"], "pending">;
}

function normalizeLimit(limit: number | undefined) {
  if (!Number.isInteger(limit) || !limit || limit <= 0) {
    return DEFAULT_APPROVAL_LIMIT;
  }

  return Math.min(limit, MAX_APPROVAL_LIMIT);
}

function toJsonObject(value: WorkflowDefinition) {
  return value as unknown as Prisma.InputJsonObject;
}

function toDataObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function cloneWorkflowDefinition(value: WorkflowDefinition) {
  return JSON.parse(JSON.stringify(value)) as WorkflowDefinition;
}

function getConfigString(
  config: Record<string, unknown> | undefined,
  key: string
) {
  const value = config?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getApprovalNodeConfig(
  node: WorkflowDefinition["nodes"][number] | undefined
): ApprovalNodeConfig {
  const config = node?.data.config;

  return {
    approverId: getConfigString(config, "approverId"),
    titleTemplate: getConfigString(config, "titleTemplate"),
    description: getConfigString(config, "description") ?? node?.data.description,
    pendingStatus:
      getConfigString(config, "pendingStatus") ?? DEFAULT_PENDING_APPROVAL_STATUS,
    approvedStatus:
      getConfigString(config, "approvedStatus") ?? DEFAULT_APPROVED_RECORD_STATUS,
    rejectedStatus:
      getConfigString(config, "rejectedStatus") ?? DEFAULT_REJECTED_RECORD_STATUS,
    returnedStatus:
      getConfigString(config, "returnedStatus") ?? DEFAULT_RETURNED_RECORD_STATUS,
  };
}

function buildDecisionComment(
  status: Exclude<Approval["status"], "pending">,
  recordStatus: string,
  commentText: string | undefined
) {
  const statusLabels: Record<Exclude<Approval["status"], "pending">, string> = {
    approved: "承認",
    rejected: "却下",
    returned: "差戻し",
  };
  const note = commentText ? ` コメント: ${commentText}` : "";
  return `${statusLabels[status]}しました。レコードステータスを「${recordStatus}」に変更しました。${note}`;
}

function buildStepDecisionComment(
  status: Exclude<Approval["status"], "pending">,
  commentText: string | undefined
) {
  const statusLabels: Record<Exclude<Approval["status"], "pending">, string> = {
    approved: "承認",
    rejected: "却下",
    returned: "差戻し",
  };
  const note = commentText ? ` コメント: ${commentText}` : "";
  return `承認ステップを${statusLabels[status]}しました。${note}`;
}

function normalizeWorkflowDefinition(value: unknown): WorkflowDefinition {
  if (!value) {
    return cloneWorkflowDefinition(DEFAULT_WORKFLOW_DEFINITION);
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new WorkflowsServiceError("Workflow definition must be an object", 400);
  }

  const candidate = value as Partial<WorkflowDefinition>;

  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    throw new WorkflowsServiceError("Workflow definition must include nodes and edges", 400);
  }

  return {
    ...candidate,
    nodes: candidate.nodes.map((node, index) => normalizeWorkflowNode(node, index)),
    edges: candidate.edges.map((edge, index) => normalizeWorkflowEdge(edge, index)),
  };
}

function normalizeWorkflowNode(value: unknown, index: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkflowsServiceError(`Workflow node ${index + 1} is invalid`, 400);
  }

  const node = value as Record<string, unknown>;
  const data = normalizeWorkflowNodeData(node.data, index);
  const position = normalizePosition(node.position);

  return {
    ...node,
    id: assertNonEmpty(typeof node.id === "string" ? node.id : undefined, "Node id"),
    type: typeof node.type === "string" ? node.type : getReactFlowNodeType(data.nodeType),
    ...(position ? { position } : {}),
    data,
  };
}

function normalizeWorkflowNodeData(value: unknown, index: number): WorkflowNodeData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkflowsServiceError(`Workflow node ${index + 1} data is invalid`, 400);
  }

  const data = value as Record<string, unknown>;
  const nodeType = data.nodeType;
  if (data.config !== undefined && (!data.config || typeof data.config !== "object" || Array.isArray(data.config))) {
    throw new WorkflowsServiceError(`Workflow node ${index + 1} config must be an object`, 400);
  }

  if (typeof nodeType !== "string") {
    throw new WorkflowsServiceError(`Workflow node ${index + 1} type is required`, 400);
  }

  return {
    ...data,
    label: assertNonEmpty(
      typeof data.label === "string" ? data.label : undefined,
      "Node label"
    ),
    description:
      typeof data.description === "string" && data.description.trim()
        ? data.description.trim()
        : undefined,
    nodeType: nodeType as WorkflowNodeData["nodeType"],
    config:
      data.config && typeof data.config === "object" && !Array.isArray(data.config)
        ? (data.config as Record<string, unknown>)
        : undefined,
    isAIProposed: data.isAIProposed === true,
  };
}

function normalizeWorkflowEdge(value: unknown, index: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkflowsServiceError(`Workflow edge ${index + 1} is invalid`, 400);
  }

  const edge = value as Record<string, unknown>;

  return {
    ...edge,
    id: assertNonEmpty(typeof edge.id === "string" ? edge.id : undefined, "Edge id"),
    source: assertNonEmpty(
      typeof edge.source === "string" ? edge.source : undefined,
      "Edge source"
    ),
    target: assertNonEmpty(
      typeof edge.target === "string" ? edge.target : undefined,
      "Edge target"
    ),
    label: typeof edge.label === "string" ? edge.label : undefined,
  };
}

function normalizePosition(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const position = value as Record<string, unknown>;

  if (typeof position.x !== "number" || typeof position.y !== "number") {
    return undefined;
  }

  return { x: position.x, y: position.y };
}

function getReactFlowNodeType(nodeType: WorkflowNodeData["nodeType"]) {
  const map: Record<WorkflowNodeData["nodeType"], string> = {
    trigger: "triggerNode",
    condition: "conditionNode",
    approval: "approvalNode",
    notification: "notificationNode",
    ai_action: "notificationNode",
    status_update: "notificationNode",
    api_call: "notificationNode",
  };

  return map[nodeType] ?? "notificationNode";
}

function toWorkflow(workflow: {
  id: string;
  tenantId: string;
  appId: string;
  name: string;
  triggerType: Workflow["triggerType"];
  status: Workflow["status"];
  definitionJson: Prisma.JsonValue;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { approvals: number };
  pendingApprovalCount?: number;
}): Workflow {
  return {
    id: workflow.id,
    tenantId: workflow.tenantId,
    appId: workflow.appId,
    name: workflow.name,
    triggerType: workflow.triggerType,
    status: workflow.status,
    definitionJson: normalizeWorkflowDefinition(workflow.definitionJson),
    createdBy: workflow.createdById,
    createdAt: workflow.createdAt.toISOString(),
    updatedAt: workflow.updatedAt.toISOString(),
    approvalCount: workflow._count?.approvals,
    pendingApprovalCount: workflow.pendingApprovalCount,
  };
}

function getRecordTitleFromData(record: {
  id: string;
  dataJson: Prisma.JsonValue;
}) {
  const data = toDataObject(record.dataJson);

  for (const key of ["title", "subject", "name", "ticket_id", "id"]) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return record.id;
}

function toApproval(approval: {
  id: string;
  tenantId: string;
  appId: string;
  tableId: string;
  recordId: string;
  workflowId: string | null;
  workflowRunId?: string | null;
  workflowNodeId?: string | null;
  appApprovalSettingId?: string | null;
  approverId: string;
  requestedById: string;
  actedById: string | null;
  status: string;
  title: string;
  description: string | null;
  commentText: string | null;
  approvalMode?: Approval["approvalMode"] | null;
  actedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  app?: { name: string } | null;
  table?: { name: string } | null;
  workflow?: { name: string } | null;
  record?: { id: string; dataJson: Prisma.JsonValue } | null;
  requestedBy?: { name: string; email: string } | null;
  approver?: { name: string; email: string } | null;
  actedBy?: { name: string; email: string } | null;
  assignees?: Array<{
    id: string;
    approvalId: string;
    userId: string;
    status: string;
    commentText: string | null;
    actedAt: Date | null;
    sortOrder: number;
    required: boolean;
    active: boolean;
    user?: { name: string; email: string } | null;
  }>;
}): Approval {
  return {
    id: approval.id,
    tenantId: approval.tenantId,
    appId: approval.appId,
    tableId: approval.tableId,
    recordId: approval.recordId,
    workflowId: approval.workflowId ?? undefined,
    workflowRunId: approval.workflowRunId ?? undefined,
    workflowNodeId: approval.workflowNodeId ?? undefined,
    appApprovalSettingId: approval.appApprovalSettingId ?? undefined,
    approverId: approval.approverId,
    requestedBy: approval.requestedById,
    actedBy: approval.actedById ?? undefined,
    status: approval.status as Approval["status"],
    title: approval.title,
    description: approval.description ?? undefined,
    commentText: approval.commentText ?? undefined,
    approvalMode: approval.approvalMode ?? undefined,
    actedAt: approval.actedAt?.toISOString(),
    createdAt: approval.createdAt.toISOString(),
    updatedAt: approval.updatedAt.toISOString(),
    appName: approval.app?.name,
    tableName: approval.table?.name,
    workflowName: approval.workflow?.name,
    recordTitle: approval.record ? getRecordTitleFromData(approval.record) : undefined,
    requesterName: approval.requestedBy?.name ?? approval.requestedBy?.email,
    approverName: approval.approver?.name ?? approval.approver?.email,
    actorName: approval.actedBy?.name ?? approval.actedBy?.email,
    assignees: approval.assignees?.map((assignee) => ({
      id: assignee.id,
      approvalId: assignee.approvalId,
      userId: assignee.userId,
      userName: assignee.user?.name ?? assignee.user?.email,
      status: assignee.status as Approval["status"],
      commentText: assignee.commentText ?? undefined,
      actedAt: assignee.actedAt?.toISOString(),
      sortOrder: assignee.sortOrder,
      required: assignee.required,
      active: assignee.active,
    })),
  };
}

function approvalInclude() {
  return {
    app: { select: { name: true } },
    table: { select: { name: true } },
    workflow: { select: { name: true } },
    record: { select: { id: true, dataJson: true } },
    requestedBy: { select: { name: true, email: true } },
    approver: { select: { name: true, email: true } },
    actedBy: { select: { name: true, email: true } },
    assignees: {
      include: { user: { select: { name: true, email: true } } },
      orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    },
  };
}

type ApprovalDecisionStatus = Exclude<Approval["status"], "pending">;

type ApprovalAction = {
  status?: string;
  dataPatch?: Record<string, unknown>;
};

type ApprovalAssigneeDecision = {
  id: string;
  userId: string;
  status: string;
  sortOrder: number;
  required: boolean;
  active: boolean;
};

function getApprovalAuditAction(status: ApprovalDecisionStatus) {
  if (status === "approved") return "APPROVAL_APPROVE";
  if (status === "returned") return "APPROVAL_RETURN";
  return "APPROVAL_REJECT";
}

function getApprovalStepAuditAction(status: ApprovalDecisionStatus) {
  if (status === "approved") return "APPROVAL_STEP_APPROVE";
  if (status === "returned") return "APPROVAL_STEP_RETURN";
  return "APPROVAL_STEP_REJECT";
}

function getNextRecordStatus(
  approval: {
    approvedStatus?: string | null;
    rejectedStatus?: string | null;
    returnedStatus?: string | null;
  },
  status: ApprovalDecisionStatus,
  workflowConfig: ApprovalNodeConfig
) {
  if (status === "approved") {
    return approval.approvedStatus ?? workflowConfig.approvedStatus;
  }
  if (status === "returned") {
    return approval.returnedStatus ?? workflowConfig.returnedStatus;
  }
  return approval.rejectedStatus ?? workflowConfig.rejectedStatus;
}

function normalizeApprovalActions(
  value: Prisma.JsonValue | null | undefined,
  status: ApprovalDecisionStatus
): ApprovalAction[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const candidate = value as Record<string, unknown>;
  const actions = candidate[status];
  if (!Array.isArray(actions)) {
    return [];
  }

  return actions
    .map((action) => {
      if (!action || typeof action !== "object" || Array.isArray(action)) {
        return null;
      }
      const item = action as Record<string, unknown>;
      const statusValue =
        typeof item.status === "string" && item.status.trim()
          ? item.status.trim()
          : undefined;
      const dataPatch =
        item.dataPatch && typeof item.dataPatch === "object" && !Array.isArray(item.dataPatch)
          ? (item.dataPatch as Record<string, unknown>)
          : undefined;

      if (!statusValue && !dataPatch) {
        return null;
      }

      return {
        ...(statusValue ? { status: statusValue } : {}),
        ...(dataPatch ? { dataPatch } : {}),
      };
    })
    .filter((action): action is ApprovalAction => action !== null);
}

function getRecordUpdateForApprovalDecision(
  record: { dataJson: Prisma.JsonValue },
  status: ApprovalDecisionStatus,
  fallbackStatus: string,
  actionsJson: Prisma.JsonValue | null | undefined
) {
  const actions = normalizeApprovalActions(actionsJson, status);
  let nextStatus = fallbackStatus;
  let nextData = toDataObject(record.dataJson);
  let hasDataPatch = false;

  for (const action of actions) {
    if (action.status) {
      nextStatus = action.status;
    }
    if (action.dataPatch) {
      nextData = { ...nextData, ...action.dataPatch };
      hasDataPatch = true;
    }
  }

  return {
    status: nextStatus,
    ...(hasDataPatch ? { dataJson: nextData as Prisma.InputJsonObject } : {}),
  };
}

function getFinalApprovalStatus(
  decisionStatus: ApprovalDecisionStatus,
  assignees: ApprovalAssigneeDecision[],
  mode: Approval["approvalMode"] | null | undefined,
  quorumCount: number | null | undefined
): Approval["status"] {
  if (decisionStatus === "rejected" || decisionStatus === "returned") {
    return decisionStatus;
  }

  const activeAssignees = assignees.filter((assignee) => assignee.active);
  if (!mode || mode === "any") return activeAssignees.some((assignee) => assignee.status === "approved") ? "approved" : "pending";
  const requiredAssignees = activeAssignees.filter((assignee) => assignee.required);
  const effectiveAssignees = requiredAssignees.length > 0 ? requiredAssignees : activeAssignees;
  const approvedCount = activeAssignees.filter(
    (assignee) => assignee.status === "approved"
  ).length;

  if (mode === "all" || mode === "sequential") {
    return effectiveAssignees.every((assignee) => assignee.status === "approved")
      ? "approved"
      : "pending";
  }

  if (mode === "quorum") {
    const threshold = Math.max(
      1,
      Math.trunc(quorumCount ?? Math.ceil(activeAssignees.length / 2))
    );
    return approvedCount >= threshold ? "approved" : "pending";
  }

  return approvedCount > 0 ? "approved" : "pending";
}

function getTargetAssignee(
  assignees: ApprovalAssigneeDecision[],
  userId: string,
  mode: Approval["approvalMode"] | null | undefined
) {
  const activePending = assignees
    .filter((assignee) => assignee.active && assignee.status === "pending")
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const userAssignee = activePending.find((assignee) => assignee.userId === userId);
  const targetAssignee = userAssignee;

  if (!targetAssignee) {
    return undefined;
  }

  if (mode === "sequential" && activePending[0]?.id !== targetAssignee.id) {
    throw new WorkflowsServiceError("Previous approval step is still pending", 409);
  }

  return targetAssignee;
}

function findApprovalNode(definitionJson: Prisma.JsonValue) {
  const definition = normalizeWorkflowDefinition(definitionJson);
  return definition.nodes.find((node) => node.data.nodeType === "approval");
}

function getRecordDataValue(
  record: { status: string; dataJson: Prisma.JsonValue },
  fieldCode: string | undefined
) {
  if (!fieldCode || fieldCode === "status") {
    return record.status;
  }

  return toDataObject(record.dataJson)[fieldCode];
}

function compareConditionValue(
  actual: unknown,
  operator: string,
  expected: string | undefined
) {
  const actualText = actual === null || actual === undefined ? "" : String(actual);
  const expectedText = expected ?? "";

  if (operator === "not_empty") {
    return actualText.trim().length > 0;
  }

  if (operator === "empty") {
    return actualText.trim().length === 0;
  }

  if (operator === "contains") {
    return actualText.toLowerCase().includes(expectedText.toLowerCase());
  }

  if (operator === "not_equals") {
    return actualText !== expectedText;
  }

  if (operator === "greater_than" || operator === "less_than") {
    const actualNumber = Number(actual);
    const expectedNumber = Number(expectedText);

    if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) {
      return false;
    }

    return operator === "greater_than"
      ? actualNumber > expectedNumber
      : actualNumber < expectedNumber;
  }

  return actualText === expectedText;
}

function conditionNodeMatches(
  node: WorkflowDefinition["nodes"][number],
  record: { status: string; dataJson: Prisma.JsonValue }
) {
  const config = node.data.config;
  const fieldCode =
    getConfigString(config, "fieldCode") ??
    getConfigString(config, "statusFieldCode") ??
    "status";
  const operator = getConfigString(config, "operator") ?? "equals";
  const rawExpected = config?.value ?? config?.expectedValue ?? config?.status;
  const expected = rawExpected === undefined || rawExpected === null ? undefined : String(rawExpected);

  if (!config || Object.keys(config).length === 0) {
    return true;
  }

  return compareConditionValue(
    getRecordDataValue(record, fieldCode),
    operator,
    expected
  );
}

function renderWorkflowTemplate(
  template: string | undefined,
  input: RunApprovalWorkflowInput
) {
  const fallback = template ?? "";
  const values: Record<string, string> = {
    appCode: input.appCode,
    tableCode: input.tableCode,
    tableName: input.tableName,
    recordId: input.recordId,
    recordTitle: input.recordTitle,
  };

  return fallback.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    return values[key] ?? "";
  });
}

function formatAIWorkflowResult(result: RuntimeAIExecution) {
  if (result.summary) {
    return `AI summary: ${result.summary}`;
  }

  if (result.nextActions?.length) {
    return `AI next actions:\n${result.nextActions
      .map((action) => `- ${action.label}: ${action.description}`)
      .join("\n")}`;
  }

  if (result.replyDraft) {
    return `AI reply draft:\n${result.replyDraft.subject}\n${result.replyDraft.body}`;
  }

  return "AI workflow action completed.";
}

async function executeNotificationNode(
  user: User,
  input: RunApprovalWorkflowInput,
  workflow: { id: string; name: string; runId: string },
  node: WorkflowDefinition["nodes"][number],
  transaction: Prisma.TransactionClient
) {
  const config = node.data.config;
  const recipients = await listWorkflowNotificationRecipients(
    user,
    config,
    user.id
  );
  const title =
    renderWorkflowTemplate(getConfigString(config, "title"), input) ||
    node.data.label ||
    "Workflow notification";
  const body =
    renderWorkflowTemplate(getConfigString(config, "body"), input) ||
    node.data.description ||
    `${input.tableName}「${input.recordTitle}」で workflow が実行されました。`;
  const dedupeKey =
    renderWorkflowTemplate(getConfigString(config, "dedupeKey"), input) ||
    `workflow-run:${workflow.runId}:node:${node.id}`;

  await createNotificationsForUsers(
    user,
    recipients.map((recipientId) => ({
      recipientId,
      actorId: user.id,
      appId: input.appId,
      recordId: input.recordId,
      type: "workflow",
      title,
      body,
      href: `/run/${input.appCode}/${input.tableCode}?recordId=${input.recordId}`,
      dedupeKey,
    })),
    transaction
  );

  await recordAuditLog(user, {
    actionType: "WORKFLOW_NOTIFICATION_SEND",
    resourceType: "workflow",
    resourceId: workflow.id,
    resourceName: workflow.name,
    detailJson: {
      nodeId: node.id,
      recipientIds: recipients,
      title,
    },
  }, transaction);
}

async function executeStatusUpdateNode(
  user: User,
  input: RunApprovalWorkflowInput,
  workflow: { id: string; name: string },
  node: WorkflowDefinition["nodes"][number],
  prisma: Prisma.TransactionClient
) {
  const nextStatus =
    getConfigString(node.data.config, "status") ??
    getConfigString(node.data.config, "recordStatus");

  if (!nextStatus) {
    return;
  }

  await prisma.appRecord.update({
    where: { id: input.recordId },
    data: {
      status: nextStatus,
      updatedById: user.id,
    },
  });
  await prisma.recordComment.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      recordId: input.recordId,
      commentText: `Workflow "${workflow.name}" changed record status to ${nextStatus}.`,
      createdById: user.id,
      isSystem: true,
    },
  });

  await recordAuditLog(user, {
    actionType: "WORKFLOW_STATUS_UPDATE",
    resourceType: "record",
    resourceId: input.recordId,
    resourceName: input.recordTitle,
    detailJson: {
      workflowId: workflow.id,
      nodeId: node.id,
      status: nextStatus,
    },
  }, prisma);
}

async function executeApiCallNode(
  user: User,
  input: RunApprovalWorkflowInput,
  workflow: { id: string; name: string; runId: string },
  node: WorkflowDefinition["nodes"][number],
  transaction: Prisma.TransactionClient
) {
  const url = getConfigString(node.data.config, "url");

  if (!url) {
    return;
  }
  const allowedOrigins = (process.env.WORKFLOW_API_ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (!allowedOrigins.includes(new URL(url).origin)) {
    throw new WorkflowsServiceError("API送信先が許可されていません。管理者がWORKFLOW_API_ALLOWED_ORIGINSを設定してください。", 400);
  }

  const method = (
    getConfigString(node.data.config, "method") ?? "POST"
  ).toUpperCase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": `${workflow.runId}:${node.id}` },
      body:
        method === "GET" || method === "HEAD"
          ? undefined
          : JSON.stringify({
              workflowId: workflow.id,
              workflowName: workflow.name,
              appId: input.appId,
              appCode: input.appCode,
              tableId: input.tableId,
              tableCode: input.tableCode,
              recordId: input.recordId,
              recordTitle: input.recordTitle,
            }),
      signal: controller.signal,
      redirect: "manual",
    });

    if (!response.ok) {
      throw new WorkflowsServiceError(
        `Workflow API call failed with ${response.status}`,
        502
      );
    }

    await recordAuditLog(user, {
      actionType: "WORKFLOW_API_CALL",
      resourceType: "workflow",
      resourceId: workflow.id,
      resourceName: workflow.name,
      detailJson: {
        nodeId: node.id,
        url,
        method,
        status: response.status,
      },
    }, transaction);
  } finally {
    clearTimeout(timeout);
  }
}

async function executeAIActionNode(
  user: User,
  input: RunApprovalWorkflowInput,
  workflow: { id: string; name: string },
  node: WorkflowDefinition["nodes"][number],
  prisma: Prisma.TransactionClient
) {
  const action = getConfigString(node.data.config, "action") ?? "summarize";

  if (!isRuntimeAIAction(action)) {
    throw new WorkflowsServiceError("Workflow AI action is invalid", 400);
  }

  const result = await executeRuntimeAIAction(
    user,
    input.appCode,
    input.tableCode,
    input.recordId,
    action
  );
  await prisma.recordComment.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      recordId: input.recordId,
      commentText: formatAIWorkflowResult(result),
      createdById: user.id,
      isSystem: true,
    },
  });

  await recordAuditLog(user, {
    actionType: "WORKFLOW_AI_ACTION",
    resourceType: "workflow",
    resourceId: workflow.id,
    resourceName: workflow.name,
    detailJson: {
      nodeId: node.id,
      action,
      modelName: result.modelName,
      totalTokens: result.usage.totalTokens,
    },
    aiInvolvement: "assisted",
  }, prisma);
}

async function executeWorkflowSideEffectNode(
  user: User,
  input: RunApprovalWorkflowInput,
  workflow: { id: string; name: string; runId: string },
  node: WorkflowDefinition["nodes"][number],
  transaction: Prisma.TransactionClient
) {
    if (node.data.nodeType === "notification") {
      await executeNotificationNode(user, input, workflow, node, transaction);
      return;
    }

    if (node.data.nodeType === "status_update") {
      await executeStatusUpdateNode(user, input, workflow, node, transaction);
      return;
    }

    if (node.data.nodeType === "api_call") {
      await executeApiCallNode(user, input, workflow, node, transaction);
      return;
    }

    if (node.data.nodeType === "ai_action") {
      await executeAIActionNode(user, input, workflow, node, transaction);
    }
}

async function getAppOrThrow(user: User, appId: string) {
  const prisma = getPrismaClient();
  const app = await prisma.app.findFirst({
    where: {
      id: assertNonEmpty(appId, "App id"),
      tenantId: user.tenantId,
    },
  });

  if (!app) {
    throw new WorkflowsServiceError("App not found", 404);
  }

  return app;
}

async function getAppByCodeOrThrow(user: User, appCode: string) {
  const prisma = getPrismaClient();
  const app = await prisma.app.findFirst({
    where: {
      code: assertNonEmpty(appCode, "App code"),
      tenantId: user.tenantId,
    },
  });

  if (!app) {
    throw new WorkflowsServiceError("App not found", 404);
  }

  return app;
}

async function getTableByCodeOrThrow(user: User, appId: string, tableCode: string) {
  const prisma = getPrismaClient();
  const table = await prisma.appTable.findFirst({
    where: {
      appId,
      tenantId: user.tenantId,
      code: assertNonEmpty(tableCode, "Table code"),
    },
  });

  if (!table) {
    throw new WorkflowsServiceError("Table not found", 404);
  }

  return table;
}

async function getRecordOrThrow(
  user: User,
  appId: string,
  tableId: string,
  recordId: string
) {
  const prisma = getPrismaClient();
  const record = await prisma.appRecord.findFirst({
    where: {
      id: assertNonEmpty(recordId, "Record id"),
      tenantId: user.tenantId,
      appId,
      tableId,
      deletedAt: null,
    },
  });

  if (!record) {
    throw new WorkflowsServiceError("Record not found", 404);
  }

  return record;
}

async function getWorkflowOrThrow(user: User, appId: string, workflowId: string) {
  await getAppOrThrow(user, appId);

  const prisma = getPrismaClient();
  const workflow = await prisma.workflow.findFirst({
    where: {
      id: assertNonEmpty(workflowId, "Workflow id"),
      appId,
      tenantId: user.tenantId,
    },
    include: {
      _count: { select: { approvals: true } },
    },
  });

  if (!workflow) {
    throw new WorkflowsServiceError("Workflow not found", 404);
  }

  return workflow;
}

async function ensureDefaultWorkflow(user: User, appId: string) {
  const prisma = getPrismaClient();
  const existingWorkflow = await prisma.workflow.findFirst({
    where: {
      tenantId: user.tenantId,
      appId,
    },
    select: { id: true },
  });

  if (existingWorkflow) {
    return;
  }

  await prisma.workflow.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      appId,
      name: "Default approval workflow",
      triggerType: "update",
      status: "active",
      definitionJson: toJsonObject(DEFAULT_WORKFLOW_DEFINITION),
      createdById: user.id,
    },
  });
}

async function attachPendingApprovalCounts(workflows: Array<Parameters<typeof toWorkflow>[0]>) {
  const prisma = getPrismaClient();

  return Promise.all(
    workflows.map(async (workflow) => ({
      ...workflow,
      pendingApprovalCount: await prisma.approval.count({
        where: {
          workflowId: workflow.id,
          status: "pending",
        },
      }),
    }))
  );
}

async function createApprovalFromWorkflow(
  user: User,
  input: {
    appId: string;
    appCode?: string;
    tableId: string;
    tableCode?: string;
    recordId: string;
    recordTitle?: string;
    workflowId?: string;
    workflowRunId?: string;
    workflowNodeId?: string;
    setting?: {
      id: string;
      approvalMode: NonNullable<Approval["approvalMode"]>;
      quorumCount: number | null;
      postApprovalActionsJson: Prisma.JsonValue | null;
    };
    assignees?: Array<{ userId: string; sortOrder: number; required: boolean }>;
    approverId?: string;
    title: string;
    description?: string;
    pendingStatus?: string;
    approvedStatus?: string;
    rejectedStatus?: string;
    returnedStatus?: string;
  },
  prisma: Prisma.TransactionClient = getPrismaClient()
) {
  const approver = await prisma.user.findFirst({ where: { id: input.approverId ?? user.id, tenantId: user.tenantId, status: "active" } });
  if (!approver) throw new WorkflowsServiceError("有効な承認者が見つかりません。", 400);
  const approval = await prisma.approval.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      appId: input.appId,
      tableId: input.tableId,
      recordId: input.recordId,
      workflowId: input.workflowId,
      workflowRunId: input.workflowRunId,
      workflowNodeId: input.workflowNodeId,
      appApprovalSettingId: input.setting?.id,
      approvalMode: input.setting?.approvalMode,
      quorumCount: input.setting?.quorumCount,
      postApprovalActionsJson: input.setting?.postApprovalActionsJson ? workflowJson(input.setting.postApprovalActionsJson) : undefined,
      assignees: input.assignees ? { create: input.assignees.map((assignee) => ({ ...assignee, tenantId: user.tenantId })) } : undefined,
      approverId: input.approverId ?? user.id,
      requestedById: user.id,
      title: input.title,
      description: input.description,
      pendingStatus: input.pendingStatus,
      approvedStatus: input.approvedStatus,
      rejectedStatus: input.rejectedStatus,
      returnedStatus: input.returnedStatus,
    },
    include: approvalInclude(),
  });

  await recordAuditLog(user, {
    actionType: "APPROVAL_CREATE",
    resourceType: "approval",
    resourceId: approval.id,
    resourceName: approval.title,
    detailJson: {
      appId: approval.appId,
      tableId: approval.tableId,
      recordId: approval.recordId,
      workflowId: approval.workflowId,
      approverId: approval.approverId,
    },
  }, prisma);

  const recipients = input.assignees?.length ? (input.setting?.approvalMode === "sequential" ? input.assignees.slice(0, 1) : input.assignees) : [{ userId: approval.approverId }];
  await createNotificationsForUsers(user, recipients.map((recipient) => ({
    recipientId: recipient.userId,
    actorId: user.id,
    appId: approval.appId,
    recordId: approval.recordId,
    type: "approval" as const,
    title: `承認依頼: ${approval.title}`,
    body:
      approval.description ??
      `${input.recordTitle ?? approval.title} の承認が必要です。`,
    href:
      input.appCode && input.tableCode
        ? `/run/${input.appCode}/approvals`
        : undefined,
    dedupeKey: `approval:${approval.id}`,
  })), prisma);

  return toApproval(approval);
}

async function markRecordPendingApproval(
  user: User,
  input: {
    appId: string;
    tableId: string;
    recordId: string;
    recordTitle: string;
    approvalIds: string[];
    workflowIds: string[];
    pendingStatus: string;
  },
  prisma: Prisma.TransactionClient = getPrismaClient()
) {
  const updatedRecord = await prisma.appRecord.update({
    where: { id: input.recordId },
    data: {
      status: input.pendingStatus,
      updatedById: user.id,
    },
  });

  await prisma.recordComment.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      recordId: input.recordId,
      commentText: `Approval requested. Record status changed to ${input.pendingStatus}.`,
      createdById: user.id,
      isSystem: true,
    },
  });

  await recordAuditLog(user, {
    actionType: "RECORD_PENDING_APPROVAL",
    resourceType: "record",
    resourceId: input.recordId,
    resourceName: input.recordTitle,
    detailJson: {
      appId: input.appId,
      tableId: input.tableId,
      status: updatedRecord.status,
      approvalIds: input.approvalIds,
      workflowIds: input.workflowIds,
    },
  }, prisma);
}

export async function listWorkflowsForApp(user: User, appId: string) {
  await ensureDemoBuilderData();
  await getAppOrThrow(user, appId);
  await requirePermission(user, "workflow:read", { appId });
  await ensureDefaultWorkflow(user, appId);

  const prisma = getPrismaClient();
  const workflows = await prisma.workflow.findMany({
    where: {
      tenantId: user.tenantId,
      appId,
    },
    include: {
      _count: { select: { approvals: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return (await attachPendingApprovalCounts(workflows)).map(toWorkflow);
}

export async function getWorkflowForApp(
  user: User,
  appId: string,
  workflowId: string
) {
  await ensureDemoBuilderData();
  const workflow = await getWorkflowOrThrow(user, appId, workflowId);
  await requirePermission(user, "workflow:read", { appId });
  const [withCounts] = await attachPendingApprovalCounts([workflow]);
  return toWorkflow(withCounts);
}

export async function createWorkflowForApp(
  user: User,
  appId: string,
  input: CreateWorkflowInput
) {
  await ensureDemoBuilderData();
  const app = await getAppOrThrow(user, appId);
  await requirePermission(user, "workflow:manage", { appId: app.id });
  const name = assertNonEmpty(input.name, "Workflow name");
  const triggerType = assertWorkflowTriggerType(input.triggerType);
  const status = assertWorkflowStatus(input.status);
  const definition = normalizeWorkflowDefinition(input.definitionJson);
  const validationErrors = validateWorkflowGraph(definition, { active: status === "active" });
  if (validationErrors.length) throw new WorkflowsServiceError(validationErrors.join("\n"), 400);
  const prisma = getPrismaClient();
  const workflow = await prisma.workflow.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      appId: app.id,
      name,
      triggerType,
      status,
      definitionJson: toJsonObject(definition),
      createdById: user.id,
    },
    include: {
      _count: { select: { approvals: true } },
    },
  });

  await recordAuditLog(user, {
    actionType: "WORKFLOW_CREATE",
    resourceType: "workflow",
    resourceId: workflow.id,
    resourceName: workflow.name,
    detailJson: {
      appId: app.id,
      appCode: app.code,
      triggerType: workflow.triggerType,
      status: workflow.status,
    },
  });

  return toWorkflow({ ...workflow, pendingApprovalCount: 0 });
}

export async function updateWorkflowForApp(
  user: User,
  appId: string,
  workflowId: string,
  input: UpdateWorkflowInput
) {
  await ensureDemoBuilderData();
  const existingWorkflow = await getWorkflowOrThrow(user, appId, workflowId);
  await requirePermission(user, "workflow:manage", { appId });
  const nextName = input.name?.trim() || existingWorkflow.name;
  const nextTriggerType =
    input.triggerType !== undefined
      ? assertWorkflowTriggerType(input.triggerType)
      : existingWorkflow.triggerType;
  const nextStatus =
    input.status !== undefined
      ? assertWorkflowStatus(input.status)
      : existingWorkflow.status;
  const nextDefinition =
    input.definitionJson !== undefined
      ? normalizeWorkflowDefinition(input.definitionJson)
      : normalizeWorkflowDefinition(existingWorkflow.definitionJson);
  const validationErrors = validateWorkflowGraph(nextDefinition, { active: nextStatus === "active" });
  if (validationErrors.length) throw new WorkflowsServiceError(validationErrors.join("\n"), 400);
  const prisma = getPrismaClient();
  const workflow = await prisma.workflow.update({
    where: { id: existingWorkflow.id },
    data: {
      name: nextName,
      triggerType: nextTriggerType,
      status: nextStatus,
      definitionJson: toJsonObject(nextDefinition),
    },
    include: {
      _count: { select: { approvals: true } },
    },
  });

  await recordAuditLog(user, {
    actionType: "WORKFLOW_UPDATE",
    resourceType: "workflow",
    resourceId: workflow.id,
    resourceName: workflow.name,
    detailJson: {
      appId,
      before: {
        name: existingWorkflow.name,
        triggerType: existingWorkflow.triggerType,
        status: existingWorkflow.status,
      },
      after: {
        name: workflow.name,
        triggerType: workflow.triggerType,
        status: workflow.status,
      },
    },
  });

  const [withCounts] = await attachPendingApprovalCounts([workflow]);
  return toWorkflow(withCounts);
}

export async function deleteWorkflowForApp(
  user: User,
  appId: string,
  workflowId: string
) {
  await ensureDemoBuilderData();
  const existingWorkflow = await getWorkflowOrThrow(user, appId, workflowId);
  await requirePermission(user, "workflow:manage", { appId });
  const prisma = getPrismaClient();
  await prisma.workflow.delete({
    where: { id: existingWorkflow.id },
  });

  await recordAuditLog(user, {
    actionType: "WORKFLOW_DELETE",
    resourceType: "workflow",
    resourceId: existingWorkflow.id,
    resourceName: existingWorkflow.name,
    detailJson: {
      appId,
      triggerType: existingWorkflow.triggerType,
      status: existingWorkflow.status,
    },
  });
}

export async function runWorkflowForRecord(
  user: User,
  appId: string,
  workflowId: string,
  input: RunWorkflowForRecordInput
) {
  await ensureDemoBuilderData();
  const workflow = await getWorkflowOrThrow(user, appId, workflowId);
  await requirePermission(user, "workflow:manage", { appId });

  if (workflow.status !== "active") {
    throw new WorkflowsServiceError("Only active workflows can be executed", 400);
  }

  const prisma = getPrismaClient();
  const [app, table, record] = await Promise.all([
    getAppOrThrow(user, appId),
    prisma.appTable.findFirst({
      where: {
        id: assertNonEmpty(input.tableId, "Table id"),
        tenantId: user.tenantId,
        appId,
      },
    }),
    prisma.appRecord.findFirst({
      where: {
        id: assertNonEmpty(input.recordId, "Record id"),
        tenantId: user.tenantId,
        appId,
        tableId: input.tableId,
        deletedAt: null,
      },
    }),
  ]);

  if (!table || !record) {
    throw new WorkflowsServiceError("Table or record not found", 404);
  }

  return runApprovalWorkflowsForRecord(user, {
    appId: app.id,
    appCode: app.code,
    tableId: table.id,
    tableCode: table.code,
    tableName: table.name,
    recordId: record.id,
    recordTitle: getRecordTitleFromData(record),
    triggerTypes: [workflow.triggerType],
    workflowIds: [workflow.id],
    failOnError: true,
  });
}

export async function runApprovalWorkflowsForRecord(
  user: User,
  input: RunApprovalWorkflowInput
) {
  const triggerTypes = [...new Set(input.triggerTypes)];

  if (triggerTypes.length === 0) {
    return [];
  }

  const prisma = getPrismaClient();
  const workflows = await prisma.workflow.findMany({
    where: {
      tenantId: user.tenantId,
      appId: input.appId,
      status: "active",
      triggerType: { in: triggerTypes },
      ...(input.workflowIds ? { id: { in: input.workflowIds } } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
  const record = await prisma.appRecord.findFirst({
    where: {
      id: input.recordId,
      tenantId: user.tenantId,
      appId: input.appId,
      tableId: input.tableId,
      deletedAt: null,
    },
    select: {
      id: true,
      status: true,
      dataJson: true,
    },
  });

  if (!record) {
    throw new WorkflowsServiceError("Record not found", 404);
  }

  const runIds: string[] = [];
  const eventKey = input.eventKey ?? crypto.randomUUID();
  for (const workflow of workflows) {
    const definition = normalizeWorkflowDefinition(workflow.definitionJson);
    const validationErrors = validateWorkflowGraph(definition, { active: true, legacy: true });
    const entryId = workflowEntryId(definition);
    const trigger = definition.nodes.find((node) => node.id === entryId)?.data.config;
    if ((trigger?.tableId && trigger.tableId !== input.tableId) || (trigger?.tableCode && trigger.tableCode !== input.tableCode)) continue;
    const run = await prisma.workflowRun.upsert({
      where: { workflowId_eventKey: { workflowId: workflow.id, eventKey } },
      update: {},
      create: {
        tenantId: user.tenantId, appId: input.appId, recordId: input.recordId,
        workflowId: workflow.id, workflowName: workflow.name, actorId: user.id, eventKey,
        definitionJson: workflowJson(definition), contextJson: workflowJson(input),
        stateJson: workflowJson({ queue: entryId ? [entryId] : [], executions: [] }),
        ...(validationErrors.length ? { status: "failed", error: validationErrors.join("\n"), finishedAt: new Date() } : {}),
      },
    });
    runIds.push(run.id);
    await executeSavedWorkflowRun(user, run.id, executeGraphNode);
  }
  if (!runIds.length) return [];
  if (input.failOnError) {
    const failed = await prisma.workflowRun.findFirst({ where: { id: { in: runIds }, tenantId: user.tenantId, status: "failed" } });
    if (failed) throw new WorkflowsServiceError(`ワークフロー「${failed.workflowName}」が失敗しました: ${failed.error} (実行ID: ${failed.id})`, 422);
  }
  return (await prisma.approval.findMany({ where: { tenantId: user.tenantId, workflowRunId: { in: runIds } }, include: approvalInclude() })).map(toApproval);
}

const executeGraphNode: WorkflowNodeExecutor = async (user, input, workflow, node, transaction) => {
  if (node.data.nodeType === "trigger") return;
  const record = await transaction.appRecord.findFirst({ where: { id: input.recordId, tenantId: user.tenantId, appId: input.appId, tableId: input.tableId, deletedAt: null } });
  if (!record) throw new WorkflowsServiceError("対象レコードが見つかりません。", 404);
  if (node.data.nodeType === "condition") return { outcome: conditionNodeMatches(node, record) ? "yes" : "no" };
  if (node.data.nodeType !== "approval") {
    await executeWorkflowSideEffectNode(user, input, workflow, node, transaction);
    return;
  }
  const policy = node.data.config?.policy;
  const setting = policy === "override" ? null : await transaction.appApprovalSetting.findFirst({
    where: { tenantId: user.tenantId, appId: input.appId, enabled: true },
    include: { approvers: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  });
  if (policy === "app" && !setting) throw new WorkflowsServiceError("アプリの承認設定を有効にしてください。", 400);
  if (setting?.targetTableId && setting.targetTableId !== input.tableId) throw new WorkflowsServiceError("アプリ承認設定の対象テーブルと一致しません。", 400);
  const assignees = setting ? await resolveApproverUsers(user, setting, transaction) : undefined;
  if (setting && !assignees?.length) throw new WorkflowsServiceError("アプリ承認設定に有効な承認者がいません。", 400);
  const config = getApprovalNodeConfig(node);
  const pendingStatus = setting?.pendingStatus ?? config.pendingStatus;
  const approval = await createApprovalFromWorkflow(user, {
    ...input, workflowId: workflow.sourceWorkflowId ?? undefined, workflowRunId: workflow.runId, workflowNodeId: node.id,
    approverId: assignees?.[0]?.userId ?? config.approverId, setting: setting ?? undefined, assignees,
    title: renderWorkflowTemplate(setting?.requestTitleTemplate ?? config.titleTemplate, input) || `${input.recordTitle} の承認`,
    description: renderWorkflowTemplate(setting?.requestBodyTemplate ?? config.description, input),
    pendingStatus, approvedStatus: setting?.approvedStatus ?? config.approvedStatus,
    rejectedStatus: setting?.rejectedStatus ?? config.rejectedStatus, returnedStatus: setting?.returnedStatus ?? config.returnedStatus,
  }, transaction);
  await markRecordPendingApproval(user, { ...input, approvalIds: [approval.id], workflowIds: [workflow.id], pendingStatus }, transaction);
  return { approvalId: approval.id };
};

export async function listWorkflowRunsForApp(user: User, appId: string, workflowId?: string) {
  await getAppOrThrow(user, appId);
  await requirePermission(user, "workflow:read", { appId });
  const runs = await getPrismaClient().workflowRun.findMany({
    where: { tenantId: user.tenantId, appId, ...(workflowId ? { workflowId } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
  });
  return runs.map(toWorkflowRun);
}

export async function resumeWorkflowRun(user: User, appId: string, runId: string) {
  await requirePermission(user, "workflow:manage", { appId });
  const prisma = getPrismaClient();
  const run = await prisma.workflowRun.findFirst({ where: { id: runId, tenantId: user.tenantId, appId } });
  if (!run) throw new WorkflowsServiceError("ワークフロー実行が見つかりません。", 404);
  if (!["ready", "waiting"].includes(run.status)) throw new WorkflowsServiceError("開始待ち・承認待ちの実行のみ再開できます。", 409);
  await executeSavedWorkflowRun(user, run.id, executeGraphNode);
  return toWorkflowRun(await prisma.workflowRun.findUniqueOrThrow({ where: { id: run.id } }));
}

export async function createApprovalForRecord(
  user: User,
  appCode: string,
  tableCode: string,
  recordId: string,
  input: CreateApprovalInput
) {
  await ensureDemoBuilderData();
  const app = await getAppByCodeOrThrow(user, appCode);
  const table = await getTableByCodeOrThrow(user, app.id, tableCode);
  await requirePermission(user, "approval:manage", {
    appId: app.id,
    tableId: table.id,
  });
  const record = await getRecordOrThrow(user, app.id, table.id, recordId);
  const workflow = input.workflowId
    ? await getWorkflowOrThrow(user, app.id, input.workflowId)
    : null;

  const approvalNode = workflow ? findApprovalNode(workflow.definitionJson) : undefined;

  if (workflow && !approvalNode) {
    throw new WorkflowsServiceError("Workflow does not contain an approval node", 400);
  }

  const approvalConfig = getApprovalNodeConfig(approvalNode);

  const approval = await createApprovalFromWorkflow(user, {
    appId: app.id,
    appCode: app.code,
    tableId: table.id,
    tableCode: table.code,
    recordId: record.id,
    recordTitle: getRecordTitleFromData(record),
    workflowId: workflow?.id,
    approverId: input.approverId ?? approvalConfig.approverId,
    title: input.title?.trim() || `${getRecordTitleFromData(record)} approval`,
    description: input.description?.trim() || undefined,
    pendingStatus: approvalConfig.pendingStatus,
    approvedStatus: approvalConfig.approvedStatus,
    rejectedStatus: approvalConfig.rejectedStatus,
    returnedStatus: approvalConfig.returnedStatus,
  });

  await markRecordPendingApproval(user, {
    appId: app.id,
    tableId: table.id,
    recordId: record.id,
    recordTitle: getRecordTitleFromData(record),
    approvalIds: [approval.id],
    workflowIds: workflow ? [workflow.id] : [],
    pendingStatus: approvalConfig.pendingStatus,
  });

  return approval;
}

export async function listApprovalsForRecord(
  user: User,
  appCode: string,
  tableCode: string,
  recordId: string
) {
  await ensureDemoBuilderData();
  const app = await getAppByCodeOrThrow(user, appCode);
  const table = await getTableByCodeOrThrow(user, app.id, tableCode);
  await requirePermission(user, "record:read", {
    appId: app.id,
    tableId: table.id,
  });
  const record = await getRecordOrThrow(user, app.id, table.id, recordId);
  const prisma = getPrismaClient();
  const approvals = await prisma.approval.findMany({
    where: {
      tenantId: user.tenantId,
      appId: app.id,
      tableId: table.id,
      recordId: record.id,
    },
    include: approvalInclude(),
    orderBy: [{ createdAt: "desc" }],
  });

  return approvals.map(toApproval);
}

export async function listApprovalsForUser(
  user: User,
  options: ListApprovalsOptions = {}
) {
  await ensureDemoBuilderData();
  await requirePermission(user, "approval:manage", {
    appId: options.appId,
  });
  const prisma = getPrismaClient();
  const status = options.status ? assertApprovalStatus(options.status) : undefined;
  const approvals = await prisma.approval.findMany({
    where: {
      tenantId: user.tenantId,
      ...(options.appId ? { appId: options.appId } : {}),
      ...(status ? { status } : {}),
    },
    include: approvalInclude(),
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: normalizeLimit(options.limit),
  });

  return approvals.map(toApproval);
}

export async function listApprovalsForRuntimeApp(
  user: User,
  appCode: string,
  options: Omit<ListApprovalsOptions, "appId"> = {}
) {
  const app = await getAppByCodeOrThrow(user, appCode);
  return listApprovalsForUser(user, { ...options, appId: app.id });
}

export async function getApprovalForUser(user: User, approvalId: string) {
  await ensureDemoBuilderData();
  await requirePermission(user, "approval:manage");
  const prisma = getPrismaClient();
  const approval = await prisma.approval.findFirst({
    where: {
      id: assertNonEmpty(approvalId, "Approval id"),
      tenantId: user.tenantId,
    },
    include: approvalInclude(),
  });

  if (!approval) {
    throw new WorkflowsServiceError("Approval not found", 404);
  }

  return toApproval(approval);
}

export async function updateApprovalDecision(
  user: User,
  approvalId: string,
  input: UpdateApprovalDecisionInput
) {
  await ensureDemoBuilderData();
  const status = assertApprovalDecisionStatus(input.status);
  const commentText = typeof input.commentText === "string" ? input.commentText.trim() || undefined : undefined;
  if (commentText && commentText.length > 10000) throw new WorkflowsServiceError("コメントは10000文字までです。", 400);
  const decided = await getPrismaClient().$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT approval.id FROM approvals AS approval
      JOIN app_records AS record ON record.id = approval.record_id
      WHERE approval.id = ${assertNonEmpty(approvalId, "Approval id")} AND approval.tenant_id = ${user.tenantId}
      AND record.deleted_at IS NULL FOR UPDATE OF approval, record`;
    const approval = await transaction.approval.findFirst({
      where: { id: approvalId, tenantId: user.tenantId, record: { deletedAt: null } },
      include: {
        record: { select: { id: true, status: true, dataJson: true } },
        workflow: { select: { definitionJson: true } },
        appApprovalSetting: { select: { quorumCount: true } },
        assignees: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] },
      },
    });
    if (!approval) throw new WorkflowsServiceError("Approval not found", 404);
    await requirePermission(user, "approval:manage", { appId: approval.appId, tableId: approval.tableId });
    if (approval.status !== "pending") throw new WorkflowsServiceError("Approval has already been decided", 409);
    const activeAssignees = approval.assignees.filter((assignee) => assignee.active);
    const targetAssignee = activeAssignees.length ? getTargetAssignee(activeAssignees, user.id, approval.approvalMode) : undefined;
    if ((activeAssignees.length && !targetAssignee) || (!activeAssignees.length && approval.approverId !== user.id)) {
      throw new WorkflowsServiceError("この申請の承認者ではないか、既に判断済みです。", 403);
    }
    const nextAssignees = activeAssignees.map((assignee) => assignee.id === targetAssignee?.id ? { ...assignee, status } : assignee);
    const finalStatus = activeAssignees.length
      ? getFinalApprovalStatus(status, nextAssignees, approval.approvalMode, approval.quorumCount ?? approval.appApprovalSetting?.quorumCount)
      : status;
    if (targetAssignee) await transaction.approvalAssignee.update({
      where: { id: targetAssignee.id }, data: { status, commentText, actedAt: new Date() },
    });

    let recordUpdate: ReturnType<typeof getRecordUpdateForApprovalDecision> | undefined;
    if (finalStatus !== "pending") {
      const node = approval.workflow
        ? normalizeWorkflowDefinition(approval.workflow.definitionJson).nodes.find((candidate) => approval.workflowNodeId ? candidate.id === approval.workflowNodeId : candidate.data.nodeType === "approval")
        : undefined;
      const nextStatus = getNextRecordStatus(approval, finalStatus, getApprovalNodeConfig(node));
      recordUpdate = getRecordUpdateForApprovalDecision(approval.record, finalStatus, nextStatus, approval.postApprovalActionsJson);
      await transaction.approval.update({
        where: { id: approval.id },
        data: { status: finalStatus, commentText, actedById: user.id, actedAt: new Date() },
      });
      await transaction.appRecord.update({ where: { id: approval.recordId }, data: { ...recordUpdate, updatedById: user.id } });
      if (activeAssignees.length) await transaction.approvalAssignee.updateMany({
        where: { approvalId: approval.id, status: "pending" }, data: { active: false },
      });
      await createNotification(user, {
        recipientId: approval.requestedById, actorId: user.id, appId: approval.appId,
        recordId: approval.recordId, type: "approval", title: `承認結果: ${approval.title}`,
        body: buildDecisionComment(finalStatus, recordUpdate.status, commentText),
        dedupeKey: `approval:${approval.id}:decision`,
      }, transaction);
    } else if (approval.approvalMode === "sequential") {
      const nextAssignee = nextAssignees.find((assignee) => assignee.status === "pending");
      if (nextAssignee) await createNotification(user, {
        recipientId: nextAssignee.userId, actorId: user.id, appId: approval.appId,
        recordId: approval.recordId, type: "approval", title: `承認依頼: ${approval.title}`,
        body: "前の承認ステップが完了しました。内容を確認してください。",
        dedupeKey: `approval:${approval.id}:step:${nextAssignee.id}`,
      }, transaction);
    }
    await transaction.recordComment.create({
      data: {
        id: crypto.randomUUID(), tenantId: user.tenantId, recordId: approval.recordId,
        commentText: finalStatus === "pending" ? buildStepDecisionComment(status, commentText) : buildDecisionComment(finalStatus, recordUpdate!.status, commentText),
        createdById: user.id, isSystem: true,
      },
    });
    await recordAuditLog(user, {
      actionType: finalStatus === "pending" ? getApprovalStepAuditAction(status) : getApprovalAuditAction(finalStatus),
      resourceType: "approval", resourceId: approval.id, resourceName: approval.title,
      detailJson: {
        appId: approval.appId, tableId: approval.tableId, recordId: approval.recordId,
        workflowId: approval.workflowId, workflowRunId: approval.workflowRunId,
        workflowNodeId: approval.workflowNodeId, appApprovalSettingId: approval.appApprovalSettingId,
        assigneeId: targetAssignee?.id, status, finalStatus, commentText,
        recordStatusBefore: approval.record.status, recordStatusAfter: recordUpdate?.status,
        dataBefore: recordUpdate?.dataJson ? approval.record.dataJson : undefined,
        dataAfter: recordUpdate?.dataJson,
      },
    }, transaction);
    return toApproval(await transaction.approval.findUniqueOrThrow({ where: { id: approval.id }, include: approvalInclude() }));
  }, { timeout: 15000 });
  if (decided.status !== "pending" && decided.workflowRunId) {
    await executeSavedWorkflowRun(user, decided.workflowRunId, executeGraphNode);
  }
  return decided;
}

export {
  DEFAULT_APPROVAL_LIMIT,
  DEFAULT_WORKFLOW_DEFINITION,
  MAX_APPROVAL_LIMIT,
};

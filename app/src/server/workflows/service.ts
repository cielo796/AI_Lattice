import { Prisma } from "@prisma/client";
import { AppsServiceError } from "@/server/apps/service";
import { ensureDemoBuilderData } from "@/server/apps/bootstrap";
import { recordAuditLog } from "@/server/audit/service";
import { getPrismaClient } from "@/server/db/prisma";
import type { Approval } from "@/types/record";
import type {
  Workflow,
  WorkflowDefinition,
  WorkflowNodeData,
} from "@/types/workflow";
import type { User } from "@/types/user";

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
  status: "approved" | "rejected";
  commentText?: string;
}

export interface ListApprovalsOptions {
  status?: Approval["status"];
  limit?: number;
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
}

const WORKFLOW_TRIGGER_TYPES: Workflow["triggerType"][] = [
  "create",
  "update",
  "schedule",
  "webhook",
  "status_change",
];
const WORKFLOW_STATUSES: Workflow["status"][] = ["draft", "active"];
const APPROVAL_STATUSES: Approval["status"][] = ["pending", "approved", "rejected"];
const DEFAULT_APPROVAL_LIMIT = 100;
const MAX_APPROVAL_LIMIT = 500;
const DEFAULT_PENDING_APPROVAL_STATUS = "pending_approval";
const DEFAULT_APPROVED_RECORD_STATUS = "approved";
const DEFAULT_REJECTED_RECORD_STATUS = "rejected";

interface ApprovalNodeConfig {
  approverId?: string;
  titleTemplate?: string;
  description?: string;
  pendingStatus: string;
  approvedStatus: string;
  rejectedStatus: string;
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
  ],
};

function assertNonEmpty(value: string | undefined, fieldName: string) {
  if (!value || !value.trim()) {
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
    throw new WorkflowsServiceError("Approval decision must be approved or rejected", 400);
  }

  return status as "approved" | "rejected";
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
  };
}

function buildDecisionComment(
  status: "approved" | "rejected",
  recordStatus: string,
  commentText: string | undefined
) {
  const note = commentText ? ` Reviewer note: ${commentText}` : "";
  return `Approval ${status}. Record status changed to ${recordStatus}.${note}`;
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

  if (typeof nodeType !== "string") {
    throw new WorkflowsServiceError(`Workflow node ${index + 1} type is required`, 400);
  }

  return {
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
  approverId: string;
  requestedById: string;
  actedById: string | null;
  status: string;
  title: string;
  description: string | null;
  commentText: string | null;
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
}): Approval {
  return {
    id: approval.id,
    tenantId: approval.tenantId,
    appId: approval.appId,
    tableId: approval.tableId,
    recordId: approval.recordId,
    workflowId: approval.workflowId ?? undefined,
    approverId: approval.approverId,
    requestedBy: approval.requestedById,
    actedBy: approval.actedById ?? undefined,
    status: approval.status as Approval["status"],
    title: approval.title,
    description: approval.description ?? undefined,
    commentText: approval.commentText ?? undefined,
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
  };
}

function findApprovalNode(definitionJson: Prisma.JsonValue) {
  const definition = normalizeWorkflowDefinition(definitionJson);
  return definition.nodes.find((node) => node.data.nodeType === "approval");
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
    tableId: string;
    recordId: string;
    workflowId?: string;
    approverId?: string;
    title: string;
    description?: string;
  }
) {
  const prisma = getPrismaClient();
  const approval = await prisma.approval.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      appId: input.appId,
      tableId: input.tableId,
      recordId: input.recordId,
      workflowId: input.workflowId,
      approverId: input.approverId ?? user.id,
      requestedById: user.id,
      title: input.title,
      description: input.description,
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
  });

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
  }
) {
  const prisma = getPrismaClient();
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
  });
}

export async function listWorkflowsForApp(user: User, appId: string) {
  await ensureDemoBuilderData();
  await getAppOrThrow(user, appId);
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
  const name = assertNonEmpty(input.name, "Workflow name");
  const triggerType = assertWorkflowTriggerType(input.triggerType);
  const status = assertWorkflowStatus(input.status);
  const definition = normalizeWorkflowDefinition(input.definitionJson);
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
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
  const approvals: Approval[] = [];
  const workflowIds: string[] = [];
  let pendingStatus = DEFAULT_PENDING_APPROVAL_STATUS;

  for (const workflow of workflows) {
    const approvalNode = findApprovalNode(workflow.definitionJson);

    if (!approvalNode) {
      continue;
    }

    const existingPendingApproval = await prisma.approval.findFirst({
      where: {
        tenantId: user.tenantId,
        workflowId: workflow.id,
        recordId: input.recordId,
        status: "pending",
      },
      select: { id: true },
    });

    if (existingPendingApproval) {
      continue;
    }

    const approvalConfig = getApprovalNodeConfig(approvalNode);

    approvals.push(
      await createApprovalFromWorkflow(user, {
        appId: input.appId,
        tableId: input.tableId,
        recordId: input.recordId,
        workflowId: workflow.id,
        approverId: approvalConfig.approverId,
        title: `${input.recordTitle} approval`,
        description:
          approvalConfig.description ??
          `Approval is required for this ${input.tableName} record.`,
      })
    );
    workflowIds.push(workflow.id);
    pendingStatus = approvalConfig.pendingStatus;
  }

  if (approvals.length > 0) {
    await markRecordPendingApproval(user, {
      appId: input.appId,
      tableId: input.tableId,
      recordId: input.recordId,
      recordTitle: input.recordTitle,
      approvalIds: approvals.map((approval) => approval.id),
      workflowIds,
      pendingStatus,
    });
  }

  return approvals;
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
    tableId: table.id,
    recordId: record.id,
    workflowId: workflow?.id,
    approverId: input.approverId ?? approvalConfig.approverId,
    title: input.title?.trim() || `${getRecordTitleFromData(record)} approval`,
    description: input.description?.trim() || undefined,
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
  const prisma = getPrismaClient();
  const status = options.status ? assertApprovalStatus(options.status) : undefined;
  const approvals = await prisma.approval.findMany({
    where: {
      tenantId: user.tenantId,
      ...(status ? { status } : {}),
    },
    include: approvalInclude(),
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: normalizeLimit(options.limit),
  });

  return approvals.map(toApproval);
}

export async function getApprovalForUser(user: User, approvalId: string) {
  await ensureDemoBuilderData();
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
  const prisma = getPrismaClient();
  const existingApproval = await prisma.approval.findFirst({
    where: {
      id: assertNonEmpty(approvalId, "Approval id"),
      tenantId: user.tenantId,
    },
    include: {
      record: { select: { id: true, status: true, dataJson: true } },
      workflow: { select: { id: true, name: true, definitionJson: true } },
    },
  });

  if (!existingApproval) {
    throw new WorkflowsServiceError("Approval not found", 404);
  }

  if (existingApproval.status !== "pending") {
    throw new WorkflowsServiceError("Approval has already been decided", 409);
  }

  const commentText = input.commentText?.trim() || undefined;
  const approvalNode = existingApproval.workflow
    ? findApprovalNode(existingApproval.workflow.definitionJson)
    : undefined;
  const approvalConfig = getApprovalNodeConfig(approvalNode);
  const nextRecordStatus =
    status === "approved"
      ? approvalConfig.approvedStatus
      : approvalConfig.rejectedStatus;
  const decidedApproval = await prisma.$transaction(async (tx) => {
    const updatedApproval = await tx.approval.update({
      where: { id: existingApproval.id },
      data: {
        status,
        commentText,
        actedById: user.id,
        actedAt: new Date(),
      },
      include: approvalInclude(),
    });

    await tx.appRecord.update({
      where: { id: existingApproval.recordId },
      data: {
        status: nextRecordStatus,
        updatedById: user.id,
      },
    });

    await tx.recordComment.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        recordId: existingApproval.recordId,
        commentText: buildDecisionComment(status, nextRecordStatus, commentText),
        createdById: user.id,
        isSystem: true,
      },
    });

    return updatedApproval;
  });

  await recordAuditLog(user, {
    actionType: status === "approved" ? "APPROVAL_APPROVE" : "APPROVAL_REJECT",
    resourceType: "approval",
    resourceId: decidedApproval.id,
    resourceName: decidedApproval.title,
    detailJson: {
      appId: decidedApproval.appId,
      tableId: decidedApproval.tableId,
      recordId: decidedApproval.recordId,
      workflowId: decidedApproval.workflowId,
      status,
      recordStatusBefore: existingApproval.record?.status,
      recordStatusAfter: nextRecordStatus,
      commentText,
    },
  });

  return toApproval(decidedApproval);
}

export {
  DEFAULT_APPROVAL_LIMIT,
  DEFAULT_WORKFLOW_DEFINITION,
  MAX_APPROVAL_LIMIT,
};

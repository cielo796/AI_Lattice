import { Prisma } from "@prisma/client";
import { requirePermission } from "@/server/admin/rbac";
import { AppsServiceError } from "@/server/apps/service";
import { ensureDemoBuilderData } from "@/server/apps/bootstrap";
import { recordAuditLog } from "@/server/audit/service";
import { getPrismaClient } from "@/server/db/prisma";
import { createNotificationsForUsers } from "@/server/notifications/service";
import type {
  AppApprovalApprover,
  AppApprovalRecordUpdateAction,
  AppApprovalSetting,
  AppApprovalUserCandidate,
  ApprovalMode,
} from "@/types/app";
import type { Approval } from "@/types/record";
import type { Role, User } from "@/types/user";

type PrismaClient = ReturnType<typeof getPrismaClient>;
type PrismaWithAppApprovals = PrismaClient & {
  appApprovalSetting: PrismaClient["appApprovalSetting"];
  appApprovalApprover: PrismaClient["appApprovalApprover"];
  approvalAssignee: PrismaClient["approvalAssignee"];
};

export interface SaveAppApprovalApproverInput {
  approverType?: "user" | "role";
  userId?: string;
  roleId?: string;
  roleType?: Role["roleType"];
  sortOrder?: number;
  required?: boolean;
  active?: boolean;
}

export interface SaveAppApprovalSettingInput {
  enabled?: boolean;
  approvalMode?: ApprovalMode;
  targetTableId?: string;
  pendingStatus?: string;
  approvedStatus?: string;
  rejectedStatus?: string;
  returnedStatus?: string;
  quorumCount?: number;
  requestTitleTemplate?: string;
  requestBodyTemplate?: string;
  conditionJson?: Record<string, unknown>;
  postApprovalActionsJson?: {
    approved?: AppApprovalRecordUpdateAction[];
    rejected?: AppApprovalRecordUpdateAction[];
    returned?: AppApprovalRecordUpdateAction[];
  };
  approvers?: SaveAppApprovalApproverInput[];
}

export interface SubmitAppApprovalInput {
  title?: string;
  description?: string;
}

const APPROVAL_MODES: ApprovalMode[] = ["any", "all", "sequential", "quorum"];
const ROLE_TYPES: Role["roleType"][] = [
  "system_admin",
  "tenant_admin",
  "app_admin",
  "approver",
  "user",
  "viewer",
];
const RECORD_STATUS_FIELD_CODE = "__record_status";

function prismaWithAppApprovals() {
  return getPrismaClient() as PrismaWithAppApprovals;
}

function toJsonObject(value: unknown) {
  return value as Prisma.InputJsonObject;
}

function toDataObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function assertStatus(value: string | undefined, fallback: string) {
  return getString(value) ?? fallback;
}

function normalizeApprovalMode(value: unknown): ApprovalMode {
  return APPROVAL_MODES.includes(value as ApprovalMode)
    ? (value as ApprovalMode)
    : "any";
}

function normalizeRoleType(value: unknown) {
  return ROLE_TYPES.includes(value as Role["roleType"])
    ? (value as Role["roleType"])
    : undefined;
}

function normalizeAction(value: unknown): AppApprovalRecordUpdateAction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const action = value as Record<string, unknown>;
  const dataPatch =
    action.dataPatch && typeof action.dataPatch === "object" && !Array.isArray(action.dataPatch)
      ? (action.dataPatch as Record<string, unknown>)
      : undefined;
  const status = getString(action.status);

  if (!status && !dataPatch) {
    return null;
  }

  return {
    target: "current_record",
    ...(status ? { status } : {}),
    ...(dataPatch ? { dataPatch } : {}),
  };
}

function normalizeActions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const source = value as Record<string, unknown>;
  const normalizeList = (key: string) =>
    Array.isArray(source[key])
      ? source[key].map(normalizeAction).filter((item): item is AppApprovalRecordUpdateAction => item !== null)
      : undefined;
  const approved = normalizeList("approved");
  const rejected = normalizeList("rejected");
  const returned = normalizeList("returned");

  return approved || rejected || returned
    ? {
        ...(approved ? { approved } : {}),
        ...(rejected ? { rejected } : {}),
        ...(returned ? { returned } : {}),
      }
    : undefined;
}

function getRecordTitleFromData(record: { id: string; dataJson: Prisma.JsonValue }) {
  const data = toDataObject(record.dataJson);
  for (const key of ["title", "subject", "name", "ticket_id", "id"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return record.id;
}

function renderTemplate(
  template: string | undefined,
  input: {
    appCode: string;
    tableCode: string;
    tableName: string;
    recordId: string;
    recordTitle: string;
  }
) {
  return (template ?? "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const values: Record<string, string> = {
      appCode: input.appCode,
      tableCode: input.tableCode,
      tableName: input.tableName,
      recordId: input.recordId,
      recordTitle: input.recordTitle,
    };
    return values[key] ?? "";
  });
}

function settingToApi(setting: {
  id: string;
  tenantId: string;
  appId: string;
  enabled: boolean;
  approvalMode: ApprovalMode;
  targetTableId: string | null;
  pendingStatus: string;
  approvedStatus: string;
  rejectedStatus: string;
  returnedStatus: string;
  quorumCount: number | null;
  requestTitleTemplate: string | null;
  requestBodyTemplate: string | null;
  conditionJson: Prisma.JsonValue | null;
  postApprovalActionsJson: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  approvers?: Array<{
    id: string;
    tenantId: string;
    settingId: string;
    approverType: string;
    userId: string | null;
    roleId: string | null;
    roleType: Role["roleType"] | null;
    sortOrder: number;
    required: boolean;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    user?: { name: string; email: string } | null;
    role?: { name: string } | null;
  }>;
}): AppApprovalSetting {
  return {
    id: setting.id,
    tenantId: setting.tenantId,
    appId: setting.appId,
    enabled: setting.enabled,
    approvalMode: setting.approvalMode,
    targetTableId: setting.targetTableId ?? undefined,
    pendingStatus: setting.pendingStatus,
    approvedStatus: setting.approvedStatus,
    rejectedStatus: setting.rejectedStatus,
    returnedStatus: setting.returnedStatus,
    quorumCount: setting.quorumCount ?? undefined,
    requestTitleTemplate: setting.requestTitleTemplate ?? undefined,
    requestBodyTemplate: setting.requestBodyTemplate ?? undefined,
    conditionJson: setting.conditionJson ? toDataObject(setting.conditionJson) : undefined,
    postApprovalActionsJson: setting.postApprovalActionsJson
      ? (setting.postApprovalActionsJson as AppApprovalSetting["postApprovalActionsJson"])
      : undefined,
    approvers: (setting.approvers ?? []).map((approver): AppApprovalApprover => ({
      id: approver.id,
      tenantId: approver.tenantId,
      settingId: approver.settingId,
      approverType: approver.approverType === "role" ? "role" : "user",
      userId: approver.userId ?? undefined,
      userName: approver.user?.name ?? approver.user?.email,
      roleId: approver.roleId ?? undefined,
      roleName: approver.role?.name,
      roleType: approver.roleType ?? undefined,
      sortOrder: approver.sortOrder,
      required: approver.required,
      active: approver.active,
      createdAt: approver.createdAt.toISOString(),
      updatedAt: approver.updatedAt.toISOString(),
    })),
    createdAt: setting.createdAt.toISOString(),
    updatedAt: setting.updatedAt.toISOString(),
  };
}

function approvalToApi(approval: {
  id: string;
  tenantId: string;
  appId: string;
  tableId: string;
  recordId: string;
  workflowId: string | null;
  appApprovalSettingId: string | null;
  approverId: string;
  requestedById: string;
  actedById: string | null;
  status: string;
  title: string;
  description: string | null;
  commentText: string | null;
  approvalMode: ApprovalMode | null;
  actedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  app?: { name: string } | null;
  table?: { name: string } | null;
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

async function getAppOrThrow(user: User, appId: string) {
  const prisma = prismaWithAppApprovals();
  const app = await prisma.app.findFirst({
    where: { id: appId, tenantId: user.tenantId },
    include: { tables: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });

  if (!app) {
    throw new AppsServiceError("App not found", 404);
  }

  return app;
}

async function getRuntimeRecordContext(
  user: User,
  appCode: string,
  tableCode: string,
  recordId: string
) {
  const prisma = prismaWithAppApprovals();
  const app = await prisma.app.findFirst({
    where: { tenantId: user.tenantId, code: appCode },
  });
  if (!app) throw new AppsServiceError("App not found", 404);
  const table = await prisma.appTable.findFirst({
    where: { tenantId: user.tenantId, appId: app.id, code: tableCode },
  });
  if (!table) throw new AppsServiceError("Table not found", 404);
  const record = await prisma.appRecord.findFirst({
    where: {
      id: recordId,
      tenantId: user.tenantId,
      appId: app.id,
      tableId: table.id,
      deletedAt: null,
    },
  });
  if (!record) throw new AppsServiceError("Record not found", 404);

  return { app, table, record };
}

async function ensureSetting(user: User, appId: string) {
  const app = await getAppOrThrow(user, appId);
  const prisma = prismaWithAppApprovals();
  const existing = await prisma.appApprovalSetting.findUnique({
    where: { appId: app.id },
    include: {
      approvers: {
        include: {
          user: { select: { name: true, email: true } },
          role: { select: { name: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.appApprovalSetting.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      appId: app.id,
      targetTableId: app.tables[0]?.id,
    },
    include: {
      approvers: {
        include: {
          user: { select: { name: true, email: true } },
          role: { select: { name: true } },
        },
      },
    },
  });
}

async function normalizeApprovers(
  user: User,
  settingId: string,
  approvers: SaveAppApprovalApproverInput[] | undefined
) {
  const prisma = prismaWithAppApprovals();
  const normalized = [];

  for (const [index, approver] of (approvers ?? []).entries()) {
    const roleType = normalizeRoleType(approver.roleType);
    const approverType = approver.approverType === "role" || approver.roleId || roleType ? "role" : "user";
    let roleId = getString(approver.roleId);

    if (approverType === "role" && !roleId && roleType) {
      const role = await prisma.role.findFirst({
        where: { tenantId: user.tenantId, roleType },
        select: { id: true },
      });
      roleId = role?.id;
    }

    if (approverType === "user") {
      const userId = getString(approver.userId);
      if (!userId) continue;
      const approverUser = await prisma.user.findFirst({
        where: { id: userId, tenantId: user.tenantId, status: "active" },
        select: { id: true },
      });
      if (!approverUser) {
        throw new AppsServiceError(`Approver user not found: ${userId}`, 400);
      }
      normalized.push({
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        settingId,
        approverType: "user",
        userId,
        sortOrder: approver.sortOrder ?? index,
        required: approver.required !== false,
        active: approver.active !== false,
      });
      continue;
    }

    if (!roleId && !roleType) continue;
    normalized.push({
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      settingId,
      approverType: "role",
      roleId,
      roleType,
      sortOrder: approver.sortOrder ?? index,
      required: approver.required !== false,
      active: approver.active !== false,
    });
  }

  return normalized;
}

function conditionMatches(conditionJson: Prisma.JsonValue | null, record: { status: string; dataJson: Prisma.JsonValue }) {
  if (!conditionJson || typeof conditionJson !== "object" || Array.isArray(conditionJson)) {
    return true;
  }
  const condition = conditionJson as Record<string, unknown>;
  const fieldCode = getString(condition.fieldCode) ?? RECORD_STATUS_FIELD_CODE;
  const operator = getString(condition.operator) ?? "equals";
  const expected = getString(condition.value) ?? getString(condition.expectedValue);
  const actual =
    fieldCode === RECORD_STATUS_FIELD_CODE
      ? record.status
      : toDataObject(record.dataJson)[fieldCode];
  const actualText = actual === undefined || actual === null ? "" : String(actual);
  const expectedText = expected ?? "";

  if (operator === "not_empty") return actualText.trim().length > 0;
  if (operator === "empty") return actualText.trim().length === 0;
  if (operator === "contains") return actualText.toLowerCase().includes(expectedText.toLowerCase());
  if (operator === "not_equals") return actualText !== expectedText;
  if (operator === "greater_than" || operator === "less_than") {
    const actualNumber = Number(actual);
    const expectedNumber = Number(expectedText);
    if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;
    return operator === "greater_than" ? actualNumber > expectedNumber : actualNumber < expectedNumber;
  }
  return actualText === expectedText;
}

async function resolveApproverUsers(
  user: User,
  setting: Awaited<ReturnType<typeof ensureSetting>>
) {
  const prisma = prismaWithAppApprovals();
  const ordered = setting.approvers.filter((approver) => approver.active);
  const resolved = new Map<string, { userId: string; sortOrder: number; required: boolean }>();

  for (const approver of ordered) {
    if (approver.approverType === "user" && approver.userId) {
      resolved.set(approver.userId, {
        userId: approver.userId,
        sortOrder: approver.sortOrder,
        required: approver.required,
      });
      continue;
    }

    const assignments = await prisma.userRole.findMany({
      where: {
        tenantId: user.tenantId,
        ...(approver.roleId ? { roleId: approver.roleId } : {}),
        ...(approver.roleType ? { role: { roleType: approver.roleType } } : {}),
        OR: [{ appId: null }, { appId: setting.appId }],
      },
      include: { user: { select: { status: true } } },
      orderBy: { createdAt: "asc" },
    });
    for (const assignment of assignments) {
      if (assignment.user.status !== "active") continue;
      if (!resolved.has(assignment.userId)) {
        resolved.set(assignment.userId, {
          userId: assignment.userId,
          sortOrder: approver.sortOrder,
          required: approver.required,
        });
      }
    }
  }

  return [...resolved.values()].sort((left, right) => left.sortOrder - right.sortOrder);
}

export async function getAppApprovalSetting(user: User, appId: string) {
  await ensureDemoBuilderData();
  await requirePermission(user, "app:read", { appId });
  return settingToApi(await ensureSetting(user, appId));
}

export async function saveAppApprovalSetting(
  user: User,
  appId: string,
  input: SaveAppApprovalSettingInput
) {
  await ensureDemoBuilderData();
  const app = await getAppOrThrow(user, appId);
  await requirePermission(user, "app:write", { appId: app.id });
  const prisma = prismaWithAppApprovals();
  const current = await ensureSetting(user, app.id);
  const approvalMode = normalizeApprovalMode(input.approvalMode ?? current.approvalMode);
  const targetTableId = getString(input.targetTableId) ?? current.targetTableId ?? app.tables[0]?.id;

  if (targetTableId) {
    const table = await prisma.appTable.findFirst({
      where: { id: targetTableId, tenantId: user.tenantId, appId: app.id },
      select: { id: true },
    });
    if (!table) {
      throw new AppsServiceError("Approval target table not found", 400);
    }
  }

  const approvers = await normalizeApprovers(user, current.id, input.approvers);
  if (input.enabled === true && approvers.filter((approver) => approver.active).length === 0) {
    throw new AppsServiceError("At least one active approver is required", 400);
  }
  const postApprovalActions = normalizeActions(input.postApprovalActionsJson);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.appApprovalSetting.update({
      where: { id: current.id },
      data: {
        enabled: input.enabled ?? current.enabled,
        approvalMode,
        targetTableId,
        pendingStatus: assertStatus(input.pendingStatus, current.pendingStatus),
        approvedStatus: assertStatus(input.approvedStatus, current.approvedStatus),
        rejectedStatus: assertStatus(input.rejectedStatus, current.rejectedStatus),
        returnedStatus: assertStatus(input.returnedStatus, current.returnedStatus),
        quorumCount:
          approvalMode === "quorum"
            ? Math.max(1, Math.trunc(input.quorumCount ?? current.quorumCount ?? 1))
            : null,
        requestTitleTemplate: getString(input.requestTitleTemplate) ?? null,
        requestBodyTemplate: getString(input.requestBodyTemplate) ?? null,
        conditionJson: input.conditionJson
          ? toJsonObject(input.conditionJson)
          : Prisma.JsonNull,
        postApprovalActionsJson: postApprovalActions
          ? toJsonObject(postApprovalActions)
          : Prisma.JsonNull,
      },
    });
    await tx.appApprovalApprover.deleteMany({ where: { settingId: current.id } });
    if (approvers.length > 0) {
      await tx.appApprovalApprover.createMany({ data: approvers });
    }
    return tx.appApprovalSetting.findUniqueOrThrow({
      where: { id: current.id },
      include: {
        approvers: {
          include: {
            user: { select: { name: true, email: true } },
            role: { select: { name: true } },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  });

  await recordAuditLog(user, {
    actionType: "APP_APPROVAL_SETTING_UPDATE",
    resourceType: "app",
    resourceId: app.id,
    resourceName: app.name,
    detailJson: {
      enabled: updated.enabled,
      approvalMode: updated.approvalMode,
      targetTableId: updated.targetTableId,
      approverCount: updated.approvers.length,
    },
  });

  return settingToApi(updated);
}

export async function listAppApprovalUserCandidates(
  user: User,
  appId: string
): Promise<AppApprovalUserCandidate[]> {
  await ensureDemoBuilderData();
  const app = await getAppOrThrow(user, appId);
  await requirePermission(user, "app:write", { appId: app.id });
  const prisma = prismaWithAppApprovals();
  const users = await prisma.user.findMany({
    where: { tenantId: user.tenantId, status: "active" },
    select: { id: true, name: true, email: true, status: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  return users.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    email: candidate.email,
    status: candidate.status,
  }));
}

export async function generateApprovalStatusViews(user: User, appId: string) {
  await ensureDemoBuilderData();
  const app = await getAppOrThrow(user, appId);
  await requirePermission(user, "app:write", { appId: app.id });
  const setting = await ensureSetting(user, app.id);
  const tableId = setting.targetTableId ?? app.tables[0]?.id;

  if (!tableId) {
    throw new AppsServiceError("Approval target table is required", 400);
  }

  const prisma = prismaWithAppApprovals();
  const existingViews = await prisma.appView.findMany({
    where: { tenantId: user.tenantId, appId: app.id, tableId },
    select: { id: true, name: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });
  let sortOrder = (existingViews.at(-1)?.sortOrder ?? 0) + 1;
  const definitions = [
    ["承認待ち", setting.pendingStatus],
    ["承認済み", setting.approvedStatus],
    ["却下", setting.rejectedStatus],
    ["差戻し", setting.returnedStatus],
  ];
  const views = [];

  for (const [name, status] of definitions) {
    const settingsJson = {
      filters: [{ fieldCode: RECORD_STATUS_FIELD_CODE, operator: "equals", value: status }],
      approvalGenerated: true,
      approvalStatus: status,
    };
    const existing = existingViews.find((view) => view.name === name);
    const view = existing
      ? await prisma.appView.update({
          where: { id: existing.id },
          data: { settingsJson: toJsonObject(settingsJson) },
        })
      : await prisma.appView.create({
          data: {
            id: crypto.randomUUID(),
            tenantId: user.tenantId,
            appId: app.id,
            tableId,
            name,
            viewType: "list",
            settingsJson: toJsonObject(settingsJson),
            sortOrder: sortOrder++,
          },
        });
    views.push(view);
  }

  await recordAuditLog(user, {
    actionType: "APP_APPROVAL_VIEWS_GENERATE",
    resourceType: "app",
    resourceId: app.id,
    resourceName: app.name,
    detailJson: { tableId, viewCount: views.length },
  });

  return { views };
}

export async function submitAppApprovalForRecord(
  user: User,
  appCode: string,
  tableCode: string,
  recordId: string,
  input: SubmitAppApprovalInput = {}
) {
  await ensureDemoBuilderData();
  const { app, table, record } = await getRuntimeRecordContext(user, appCode, tableCode, recordId);
  await requirePermission(user, "record:write", { appId: app.id, tableId: table.id });
  const setting = await ensureSetting(user, app.id);

  if (!setting.enabled) {
    throw new AppsServiceError("Approval is not enabled for this app", 400);
  }

  if (setting.targetTableId && setting.targetTableId !== table.id) {
    throw new AppsServiceError("This table is not configured for app approval", 400);
  }

  if (!conditionMatches(setting.conditionJson, record)) {
    throw new AppsServiceError("Record does not match approval conditions", 400);
  }

  const prisma = prismaWithAppApprovals();
  const existingPending = await prisma.approval.findFirst({
    where: {
      tenantId: user.tenantId,
      appId: app.id,
      tableId: table.id,
      recordId: record.id,
      appApprovalSettingId: setting.id,
      status: "pending",
    },
    include: { assignees: true },
  });

  if (existingPending) {
    throw new AppsServiceError("A pending approval already exists for this record", 409);
  }

  const assignees = await resolveApproverUsers(user, setting);
  if (assignees.length === 0) {
    throw new AppsServiceError("No active approvers are configured for this app", 400);
  }

  const recordTitle = getRecordTitleFromData(record);
  const title =
    getString(input.title) ||
    renderTemplate(setting.requestTitleTemplate ?? undefined, {
      appCode: app.code,
      tableCode: table.code,
      tableName: table.name,
      recordId: record.id,
      recordTitle,
    }) ||
    `${recordTitle} の承認依頼`;
  const description =
    getString(input.description) ||
    renderTemplate(setting.requestBodyTemplate ?? undefined, {
      appCode: app.code,
      tableCode: table.code,
      tableName: table.name,
      recordId: record.id,
      recordTitle,
    }) ||
    `${table.name}「${recordTitle}」の内容を確認し、承認・却下・差戻しを判断してください。`;

  const approval = await prisma.$transaction(async (tx) => {
    const created = await tx.approval.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        appId: app.id,
        tableId: table.id,
        recordId: record.id,
        appApprovalSettingId: setting.id,
        approverId: assignees[0].userId,
        requestedById: user.id,
        title,
        description,
        approvalMode: setting.approvalMode,
        pendingStatus: setting.pendingStatus,
        approvedStatus: setting.approvedStatus,
        rejectedStatus: setting.rejectedStatus,
        returnedStatus: setting.returnedStatus,
        postApprovalActionsJson: setting.postApprovalActionsJson
          ? (setting.postApprovalActionsJson as Prisma.InputJsonValue)
          : undefined,
      },
    });
    await tx.approvalAssignee.createMany({
      data: assignees.map((assignee, index) => ({
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        approvalId: created.id,
        userId: assignee.userId,
        sortOrder: assignee.sortOrder ?? index,
        required: assignee.required,
        active: true,
      })),
    });
    await tx.appRecord.update({
      where: { id: record.id },
      data: { status: setting.pendingStatus, updatedById: user.id },
    });
    await tx.recordComment.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        recordId: record.id,
        commentText: `承認申請を作成しました。レコードステータスを「${setting.pendingStatus}」に変更しました。`,
        createdById: user.id,
        isSystem: true,
      },
    });
    return tx.approval.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        app: { select: { name: true } },
        table: { select: { name: true } },
        record: { select: { id: true, dataJson: true } },
        requestedBy: { select: { name: true, email: true } },
        approver: { select: { name: true, email: true } },
        actedBy: { select: { name: true, email: true } },
        assignees: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  });

  await createNotificationsForUsers(
    user,
    assignees.map((assignee) => ({
      recipientId: assignee.userId,
      actorId: user.id,
      appId: app.id,
      recordId: record.id,
      type: "approval",
      title: `承認依頼: ${title}`,
      body: description,
      href: `/run/${app.code}/approvals`,
      dedupeKey: `approval:${approval.id}:assignee:${assignee.userId}`,
    }))
  );

  await recordAuditLog(user, {
    actionType: "APP_APPROVAL_SUBMIT",
    resourceType: "approval",
    resourceId: approval.id,
    resourceName: approval.title,
    detailJson: {
      appId: app.id,
      tableId: table.id,
      recordId: record.id,
      settingId: setting.id,
      assigneeIds: assignees.map((assignee) => assignee.userId),
    },
  });

  return approvalToApi(approval);
}

import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/server/db/prisma";
import type { AuditLog } from "@/types/audit";
import type { User } from "@/types/user";

const DEFAULT_AUDIT_LOG_LIMIT = 100;
const MAX_AUDIT_LOG_LIMIT = 500;

export interface RecordAuditLogInput {
  actionType: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  detailJson?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  result?: AuditLog["result"];
  aiInvolvement?: AuditLog["aiInvolvement"];
}

export interface ListAuditLogsOptions {
  limit?: number;
  actionType?: string;
  resourceType?: string;
}

function getErrorStatus(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : undefined;
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeLimit(limit: number | undefined) {
  if (!Number.isInteger(limit) || !limit || limit <= 0) {
    return DEFAULT_AUDIT_LOG_LIMIT;
  }

  return Math.min(limit, MAX_AUDIT_LOG_LIMIT);
}

function toInputJsonObject(value: Record<string, unknown> | undefined) {
  if (!value) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function toDetailJson(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function toAuditLog(log: {
  id: string;
  tenantId: string;
  actorId: string;
  actorName: string;
  actionType: string;
  resourceType: string;
  resourceId: string | null;
  resourceName: string | null;
  detailJson: Prisma.JsonValue | null;
  ipAddress: string | null;
  userAgent: string | null;
  result: string;
  aiInvolvement: string;
  createdAt: Date;
}): AuditLog {
  return {
    id: log.id,
    tenantId: log.tenantId,
    actorId: log.actorId,
    actorName: log.actorName,
    actionType: log.actionType,
    resourceType: log.resourceType,
    resourceId: log.resourceId ?? undefined,
    resourceName: log.resourceName ?? undefined,
    detailJson: toDetailJson(log.detailJson),
    ipAddress: log.ipAddress ?? undefined,
    userAgent: log.userAgent ?? undefined,
    result: log.result as AuditLog["result"],
    aiInvolvement: log.aiInvolvement as AuditLog["aiInvolvement"],
    createdAt: log.createdAt.toISOString(),
  };
}

export async function recordAuditLog(
  user: Pick<User, "id" | "tenantId" | "name" | "email">,
  input: RecordAuditLogInput
) {
  const prisma = getPrismaClient();
  const log = await prisma.auditLog.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name || user.email,
      actionType: input.actionType,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      resourceName: input.resourceName,
      detailJson: toInputJsonObject(input.detailJson),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      result: input.result ?? "success",
      aiInvolvement: input.aiInvolvement ?? "none",
    },
  });

  return toAuditLog(log);
}

export function getAuditFailureResult(error: unknown): NonNullable<AuditLog["result"]> {
  const status = getErrorStatus(error);
  return status === 401 || status === 403 ? "denied" : "error";
}

export async function recordAuditFailure(
  user: Pick<User, "id" | "tenantId" | "name" | "email">,
  input: Omit<RecordAuditLogInput, "result">,
  error: unknown
) {
  try {
    return await recordAuditLog(user, {
      ...input,
      result: getAuditFailureResult(error),
      detailJson: {
        ...input.detailJson,
        failure: {
          status: getErrorStatus(error),
          name: getErrorName(error),
          message: getErrorMessage(error),
        },
      },
    });
  } catch {
    return null;
  }
}

export async function listAuditLogsForUser(
  user: Pick<User, "tenantId">,
  options: ListAuditLogsOptions = {}
) {
  const prisma = getPrismaClient();
  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId: user.tenantId,
      ...(options.actionType ? { actionType: options.actionType } : {}),
      ...(options.resourceType ? { resourceType: options.resourceType } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: normalizeLimit(options.limit),
  });

  return logs.map(toAuditLog);
}

export { DEFAULT_AUDIT_LOG_LIMIT, MAX_AUDIT_LOG_LIMIT };

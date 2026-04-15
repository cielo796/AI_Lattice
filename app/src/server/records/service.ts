import { Prisma } from "@prisma/client";
import { AppsServiceError } from "@/server/apps/service";
import { getPrismaClient } from "@/server/db/prisma";
import { ensureDemoRecordData } from "@/server/records/bootstrap";
import type { AppField, FieldType, RuntimeTableMeta } from "@/types/app";
import type {
  AppRecord,
  Attachment as RecordAttachment,
  RecordComment,
} from "@/types/record";
import type { User } from "@/types/user";

export class RecordsServiceError extends AppsServiceError {
  constructor(
    message: string,
    status: number
  ) {
    super(message, status);
    this.name = "RecordsServiceError";
  }
}

export interface CreateRecordInput {
  status?: string;
  data: Record<string, unknown>;
}

export interface UpdateRecordInput {
  status?: string;
  data?: Record<string, unknown>;
}

export interface CreateRecordCommentInput {
  commentText: string;
  isSystem?: boolean;
}

export interface CreateAttachmentInput {
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
}

function assertNonEmpty(value: string | undefined, fieldName: string) {
  if (!value || !value.trim()) {
    throw new RecordsServiceError(`${fieldName} is required`, 400);
  }

  return value.trim();
}

function assertRecordData(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RecordsServiceError("Record data must be an object", 400);
  }

  return value as Record<string, unknown>;
}

function assertFileSize(value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RecordsServiceError("File size must be a non-negative integer", 400);
  }

  return value;
}

function toJsonObject(value: Record<string, unknown>) {
  return value as Prisma.InputJsonObject;
}

function toSettingsJson(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function toDataObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toRuntimeTable(table: {
  id: string;
  name: string;
  code: string;
}): RuntimeTableMeta["table"] {
  return {
    id: table.id,
    name: table.name,
    code: table.code,
  };
}

function toAppField(field: {
  id: string;
  tenantId: string;
  appId: string;
  tableId: string;
  name: string;
  code: string;
  fieldType: FieldType;
  required: boolean;
  uniqueFlag: boolean;
  defaultValue: Prisma.JsonValue | null;
  settingsJson: Prisma.JsonValue | null;
  sortOrder: number;
  createdAt: Date;
}): AppField {
  return {
    id: field.id,
    tenantId: field.tenantId,
    appId: field.appId,
    tableId: field.tableId,
    name: field.name,
    code: field.code,
    fieldType: field.fieldType,
    required: field.required,
    uniqueFlag: field.uniqueFlag,
    defaultValue: field.defaultValue ?? undefined,
    settingsJson: toSettingsJson(field.settingsJson),
    sortOrder: field.sortOrder,
    createdAt: field.createdAt.toISOString(),
  };
}

function toAppRecord(record: {
  id: string;
  tenantId: string;
  appId: string;
  tableId: string;
  status: string;
  dataJson: Prisma.JsonValue;
  createdById: string;
  updatedById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): AppRecord {
  return {
    id: record.id,
    tenantId: record.tenantId,
    appId: record.appId,
    tableId: record.tableId,
    status: record.status,
    data: toDataObject(record.dataJson),
    createdBy: record.createdById,
    updatedBy: record.updatedById,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt?.toISOString(),
  };
}

function toRecordComment(comment: {
  id: string;
  tenantId: string;
  recordId: string;
  commentText: string;
  createdById: string;
  createdAt: Date;
  isSystem: boolean;
}): RecordComment {
  return {
    id: comment.id,
    tenantId: comment.tenantId,
    recordId: comment.recordId,
    commentText: comment.commentText,
    createdBy: comment.createdById,
    createdAt: comment.createdAt.toISOString(),
    isSystem: comment.isSystem,
  };
}

function toAttachment(attachment: {
  id: string;
  tenantId: string;
  recordId: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  uploadedById: string;
  createdAt: Date;
}): RecordAttachment {
  return {
    id: attachment.id,
    tenantId: attachment.tenantId,
    recordId: attachment.recordId,
    fileName: attachment.fileName,
    storagePath: attachment.storagePath,
    mimeType: attachment.mimeType,
    fileSize: attachment.fileSize,
    uploadedBy: attachment.uploadedById,
    createdAt: attachment.createdAt.toISOString(),
  };
}

async function getAppByCodeOrThrow(user: User, appCode: string) {
  const normalizedCode = assertNonEmpty(appCode, "App code");
  const prisma = getPrismaClient();
  const app = await prisma.app.findFirst({
    where: {
      tenantId: user.tenantId,
      code: normalizedCode,
    },
  });

  if (!app) {
    throw new RecordsServiceError("App not found", 404);
  }

  return app;
}

async function getTableByCodeOrThrow(user: User, appCode: string, tableCode: string) {
  const app = await getAppByCodeOrThrow(user, appCode);
  const normalizedCode = assertNonEmpty(tableCode, "Table code");
  const prisma = getPrismaClient();
  const table = await prisma.appTable.findFirst({
    where: {
      tenantId: user.tenantId,
      appId: app.id,
      code: normalizedCode,
    },
  });

  if (!table) {
    throw new RecordsServiceError("Table not found", 404);
  }

  return { app, table };
}

async function getRecordOrThrow(
  user: User,
  appCode: string,
  tableCode: string,
  recordId: string
) {
  const { app, table } = await getTableByCodeOrThrow(user, appCode, tableCode);
  const prisma = getPrismaClient();
  const record = await prisma.appRecord.findFirst({
    where: {
      id: assertNonEmpty(recordId, "Record id"),
      tenantId: user.tenantId,
      appId: app.id,
      tableId: table.id,
      deletedAt: null,
    },
  });

  if (!record) {
    throw new RecordsServiceError("Record not found", 404);
  }

  return { app, table, record };
}

async function getAttachmentOrThrow(
  user: User,
  appCode: string,
  tableCode: string,
  recordId: string,
  attachmentId: string
) {
  const { record } = await getRecordOrThrow(user, appCode, tableCode, recordId);
  const prisma = getPrismaClient();
  const attachment = await prisma.attachment.findFirst({
    where: {
      id: assertNonEmpty(attachmentId, "Attachment id"),
      tenantId: user.tenantId,
      recordId: record.id,
    },
  });

  if (!attachment) {
    throw new RecordsServiceError("Attachment not found", 404);
  }

  return attachment;
}

export async function listRecordsForTable(
  user: User,
  appCode: string,
  tableCode: string
) {
  await ensureDemoRecordData();
  const { app, table } = await getTableByCodeOrThrow(user, appCode, tableCode);
  const prisma = getPrismaClient();
  const records = await prisma.appRecord.findMany({
    where: {
      tenantId: user.tenantId,
      appId: app.id,
      tableId: table.id,
      deletedAt: null,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return records.map(toAppRecord);
}

export async function getRuntimeTableMeta(
  user: User,
  appCode: string,
  tableCode: string
): Promise<RuntimeTableMeta> {
  await ensureDemoRecordData();
  const { app, table } = await getTableByCodeOrThrow(user, appCode, tableCode);
  const prisma = getPrismaClient();
  const fields = await prisma.appField.findMany({
    where: {
      tenantId: user.tenantId,
      appId: app.id,
      tableId: table.id,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return {
    table: toRuntimeTable(table),
    fields: fields.map((field) =>
      toAppField(field as typeof field & { fieldType: FieldType })
    ),
  };
}

export async function createRecordForTable(
  user: User,
  appCode: string,
  tableCode: string,
  input: CreateRecordInput
) {
  await ensureDemoRecordData();
  const { app, table } = await getTableByCodeOrThrow(user, appCode, tableCode);
  const data = assertRecordData(input.data);
  const prisma = getPrismaClient();
  const record = await prisma.appRecord.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      appId: app.id,
      tableId: table.id,
      status: input.status?.trim() || "active",
      dataJson: toJsonObject(data),
      createdById: user.id,
      updatedById: user.id,
    },
  });

  return toAppRecord(record);
}

export async function getRecordForTable(
  user: User,
  appCode: string,
  tableCode: string,
  recordId: string
) {
  await ensureDemoRecordData();
  const { record } = await getRecordOrThrow(user, appCode, tableCode, recordId);
  return toAppRecord(record);
}

export async function updateRecordForTable(
  user: User,
  appCode: string,
  tableCode: string,
  recordId: string,
  input: UpdateRecordInput
) {
  await ensureDemoRecordData();
  const { record } = await getRecordOrThrow(user, appCode, tableCode, recordId);
  const prisma = getPrismaClient();
  const nextData =
    input.data !== undefined
      ? toJsonObject(assertRecordData(input.data))
      : toJsonObject(toDataObject(record.dataJson));
  const nextStatus =
    input.status !== undefined ? assertNonEmpty(input.status, "Status") : record.status;

  const updatedRecord = await prisma.appRecord.update({
    where: { id: record.id },
    data: {
      status: nextStatus,
      dataJson: nextData,
      updatedById: user.id,
      deletedAt: null,
    },
  });

  return toAppRecord(updatedRecord);
}

export async function deleteRecordForTable(
  user: User,
  appCode: string,
  tableCode: string,
  recordId: string
) {
  await ensureDemoRecordData();
  const { record } = await getRecordOrThrow(user, appCode, tableCode, recordId);
  const prisma = getPrismaClient();
  await prisma.appRecord.update({
    where: { id: record.id },
    data: {
      deletedAt: new Date(),
      updatedById: user.id,
    },
  });
}

export async function listCommentsForRecord(
  user: User,
  appCode: string,
  tableCode: string,
  recordId: string
) {
  await ensureDemoRecordData();
  const { record } = await getRecordOrThrow(user, appCode, tableCode, recordId);
  const prisma = getPrismaClient();
  const comments = await prisma.recordComment.findMany({
    where: {
      tenantId: user.tenantId,
      recordId: record.id,
    },
    orderBy: [{ createdAt: "asc" }],
  });

  return comments.map(toRecordComment);
}

export async function createCommentForRecord(
  user: User,
  appCode: string,
  tableCode: string,
  recordId: string,
  input: CreateRecordCommentInput
) {
  await ensureDemoRecordData();
  const { record } = await getRecordOrThrow(user, appCode, tableCode, recordId);
  const prisma = getPrismaClient();
  const comment = await prisma.recordComment.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      recordId: record.id,
      commentText: assertNonEmpty(input.commentText, "Comment text"),
      createdById: user.id,
      isSystem: input.isSystem ?? false,
    },
  });

  return toRecordComment(comment);
}

export async function listAttachmentsForRecord(
  user: User,
  appCode: string,
  tableCode: string,
  recordId: string
) {
  await ensureDemoRecordData();
  const { record } = await getRecordOrThrow(user, appCode, tableCode, recordId);
  const prisma = getPrismaClient();
  const attachments = await prisma.attachment.findMany({
    where: {
      tenantId: user.tenantId,
      recordId: record.id,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return attachments.map(toAttachment);
}

export async function createAttachmentForRecord(
  user: User,
  appCode: string,
  tableCode: string,
  recordId: string,
  input: CreateAttachmentInput
) {
  await ensureDemoRecordData();
  const { record } = await getRecordOrThrow(user, appCode, tableCode, recordId);
  const prisma = getPrismaClient();
  const attachment = await prisma.attachment.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      recordId: record.id,
      fileName: assertNonEmpty(input.fileName, "File name"),
      storagePath: assertNonEmpty(input.storagePath, "Storage path"),
      mimeType: assertNonEmpty(input.mimeType, "MIME type"),
      fileSize: assertFileSize(input.fileSize),
      uploadedById: user.id,
    },
  });

  return toAttachment(attachment);
}

export async function deleteAttachmentForRecord(
  user: User,
  appCode: string,
  tableCode: string,
  recordId: string,
  attachmentId: string
) {
  await ensureDemoRecordData();
  const attachment = await getAttachmentOrThrow(
    user,
    appCode,
    tableCode,
    recordId,
    attachmentId
  );
  const prisma = getPrismaClient();
  await prisma.attachment.delete({
    where: { id: attachment.id },
  });

  return toAttachment(attachment);
}

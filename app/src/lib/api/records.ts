import { apiFetch } from "@/lib/api/client";
import type { RuntimeTableMeta } from "@/types/app";
import type {
  AppRecord,
  Attachment,
  RecordComment,
} from "@/types/record";

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

function tablePath(appCode: string, tableCode: string) {
  return `/api/run/${appCode}/${tableCode}`;
}

function tableMetaPath(appCode: string, tableCode: string) {
  return `${tablePath(appCode, tableCode)}/meta`;
}

function recordPath(appCode: string, tableCode: string, recordId: string) {
  return `${tablePath(appCode, tableCode)}/${recordId}`;
}

function commentsPath(appCode: string, tableCode: string, recordId: string) {
  return `${recordPath(appCode, tableCode, recordId)}/comments`;
}

function attachmentsPath(appCode: string, tableCode: string, recordId: string) {
  return `${recordPath(appCode, tableCode, recordId)}/attachments`;
}

function attachmentPath(
  appCode: string,
  tableCode: string,
  recordId: string,
  attachmentId: string
) {
  return `${attachmentsPath(appCode, tableCode, recordId)}/${attachmentId}`;
}

export async function listRecords(appCode: string, tableCode: string) {
  return apiFetch<AppRecord[]>(tablePath(appCode, tableCode));
}

export async function getRuntimeTableMeta(appCode: string, tableCode: string) {
  return apiFetch<RuntimeTableMeta>(tableMetaPath(appCode, tableCode));
}

export async function createRecord(
  appCode: string,
  tableCode: string,
  input: CreateRecordInput
) {
  return apiFetch<AppRecord>(tablePath(appCode, tableCode), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getRecord(
  appCode: string,
  tableCode: string,
  recordId: string
) {
  return apiFetch<AppRecord>(recordPath(appCode, tableCode, recordId));
}

export async function updateRecord(
  appCode: string,
  tableCode: string,
  recordId: string,
  input: UpdateRecordInput
) {
  return apiFetch<AppRecord>(recordPath(appCode, tableCode, recordId), {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteRecord(
  appCode: string,
  tableCode: string,
  recordId: string
) {
  await apiFetch<string>(recordPath(appCode, tableCode, recordId), {
    method: "DELETE",
  });
}

export async function listComments(
  appCode: string,
  tableCode: string,
  recordId: string
) {
  return apiFetch<RecordComment[]>(commentsPath(appCode, tableCode, recordId));
}

export async function createComment(
  appCode: string,
  tableCode: string,
  recordId: string,
  input: CreateRecordCommentInput
) {
  return apiFetch<RecordComment>(commentsPath(appCode, tableCode, recordId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listAttachments(
  appCode: string,
  tableCode: string,
  recordId: string
) {
  return apiFetch<Attachment[]>(attachmentsPath(appCode, tableCode, recordId));
}

export async function createAttachment(
  appCode: string,
  tableCode: string,
  recordId: string,
  input: CreateAttachmentInput
) {
  return apiFetch<Attachment>(attachmentsPath(appCode, tableCode, recordId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function uploadAttachment(
  appCode: string,
  tableCode: string,
  recordId: string,
  file: File
) {
  const body = new FormData();
  body.set("file", file);

  return apiFetch<Attachment>(attachmentsPath(appCode, tableCode, recordId), {
    method: "POST",
    body,
  });
}

export async function deleteAttachment(
  appCode: string,
  tableCode: string,
  recordId: string,
  attachmentId: string
) {
  await apiFetch<string>(
    attachmentPath(appCode, tableCode, recordId, attachmentId),
    {
      method: "DELETE",
    }
  );
}

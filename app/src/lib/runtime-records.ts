import type { AppField } from "@/types/app";
import type { AppRecord } from "@/types/record";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "ai";
type FieldLabelSource = Pick<AppField, "code" | "name">;
type ReferenceFieldSource = Pick<AppField, "code" | "fieldType" | "settingsJson">;

export type ReferenceLabelsByField = Record<string, Record<string, string>>;
export type ReferenceRecordsByField = Record<string, Record<string, AppRecord>>;
export type ReferenceFieldsByField = Record<string, AppField[]>;

export function getRecordData(record: AppRecord | null | undefined) {
  if (!record || !record.data || typeof record.data !== "object") {
    return {} as Record<string, unknown>;
  }

  return record.data as Record<string, unknown>;
}

function getStringValue(data: Record<string, unknown>, key: string) {
  const value = data[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const normalizedValues = value
      .filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0
      )
      .map((item) => item.trim());

    return normalizedValues.join(", ");
  }

  return "";
}

export function getRecordIdentifier(record: AppRecord | null | undefined) {
  const data = getRecordData(record);

  return (
    getStringValue(data, "ticket_id") ||
    getStringValue(data, "code") ||
    getStringValue(data, "id") ||
    getStringValue(data, "claim_id") ||
    getStringValue(data, "request_id") ||
    getStringValue(data, "application_id") ||
    record?.id ||
    "レコード"
  );
}

export function getRecordTitle(record: AppRecord | null | undefined) {
  const data = getRecordData(record);

  return (
    getStringValue(data, "subject") ||
    getStringValue(data, "title") ||
    getStringValue(data, "name") ||
    getStringValue(data, "item_name") ||
    getStringValue(data, "applicant_name") ||
    getStringValue(data, "requester_name") ||
    getRecordIdentifier(record)
  );
}

export function getRecordDescription(record: AppRecord | null | undefined) {
  const data = getRecordData(record);

  return (
    getStringValue(data, "description") ||
    getStringValue(data, "summary") ||
    getStringValue(data, "details")
  );
}

export function getRecordPriority(record: AppRecord | null | undefined) {
  return getStringValue(getRecordData(record), "priority");
}

export function getRecordCustomer(record: AppRecord | null | undefined) {
  const data = getRecordData(record);

  return (
    getStringValue(data, "customer") ||
    getStringValue(data, "requester") ||
    getStringValue(data, "applicant_name") ||
    getStringValue(data, "employee_name") ||
    getStringValue(data, "account")
  );
}

export function getRecordSentiment(record: AppRecord | null | undefined) {
  const value = getRecordData(record).sentiment_score;
  return typeof value === "number" ? value : null;
}

export function formatRelativeTime(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}分前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}時間前`;
  }

  return `${Math.floor(diffHours / 24)}日前`;
}

export function formatDateTime(dateStr: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(dateStr));
}

function formatFallbackFieldKey(key: string) {
  const labels: Record<string, string> = {
    ticket_id: "チケット ID",
    code: "コード",
    id: "ID",
    status: "ステータス",
    priority: "優先度",
    customer: "顧客",
    requester: "依頼者",
    applicant_name: "申請者",
    employee_name: "従業員",
    claim_id: "申請ID",
    request_id: "依頼ID",
    application_id: "申請ID",
    item_name: "項目名",
    item_amount: "金額",
    item_category: "カテゴリ",
    item_date: "日付",
    item_notes: "備考",
    account: "アカウント",
    assignee: "担当者",
    sentiment_score: "感情スコア",
    created_at: "作成日時",
    updated_at: "更新日時",
  };

  return labels[key] ?? key.replace(/[_-]+/g, " ");
}

export function getFieldDisplayName(field: FieldLabelSource) {
  const configuredName = field.name.trim();
  return configuredName || formatFallbackFieldKey(field.code);
}

export function getReferenceTableCode(
  field: Pick<AppField, "settingsJson">
) {
  const referenceTableCode = field.settingsJson?.referenceTableCode;
  return typeof referenceTableCode === "string" ? referenceTableCode : "";
}

export function getReferenceTableId(
  field: Pick<AppField, "settingsJson">
) {
  const referenceTableId = field.settingsJson?.referenceTableId;
  if (typeof referenceTableId === "string" && referenceTableId.trim()) {
    return referenceTableId;
  }

  const legacyReferenceTableId = field.settingsJson?.refTable;
  return typeof legacyReferenceTableId === "string" ? legacyReferenceTableId : "";
}

export function getReferenceDisplayFieldCode(
  field: Pick<AppField, "settingsJson">
) {
  const displayFieldCode = field.settingsJson?.displayFieldCode;
  return typeof displayFieldCode === "string" ? displayFieldCode : "";
}

export function getReferenceLookupFieldCodes(
  field: Pick<AppField, "settingsJson">
) {
  const lookupFieldCodes = field.settingsJson?.lookupFieldCodes;

  if (!Array.isArray(lookupFieldCodes)) {
    return [];
  }

  return lookupFieldCodes.filter(
    (lookupFieldCode): lookupFieldCode is string =>
      typeof lookupFieldCode === "string" && lookupFieldCode.trim().length > 0
  );
}

export function isMultiReferenceField(
  field: Pick<AppField, "settingsJson">
) {
  return field.settingsJson?.multiple === true;
}

export function shouldShowBackReference(
  field: Pick<AppField, "settingsJson">
) {
  return field.settingsJson?.showBackReference === true;
}

export function getReferenceValueIds(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

export function getRecordFieldValueText(
  record: AppRecord | null | undefined,
  fieldCode: string
) {
  const value = getRecordData(record)[fieldCode];

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .filter(
        (item): item is string | number | boolean =>
          typeof item === "string" || typeof item === "number" || typeof item === "boolean"
      )
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join(", ");
  }

  return "";
}

export function getReferenceRecordLabel(
  record: AppRecord | null | undefined,
  displayFieldCode?: string
) {
  const configuredLabel = displayFieldCode
    ? getRecordFieldValueText(record, displayFieldCode)
    : "";

  return configuredLabel || getRecordTitle(record);
}

export function formatFieldKey(key: string, fields: FieldLabelSource[] = []) {
  const matchedField = fields.find((field) => field.code === key);

  if (matchedField) {
    return getFieldDisplayName(matchedField);
  }

  return formatFallbackFieldKey(key);
}

export function formatPriorityLabel(priority: string) {
  const normalized = priority.toLowerCase();

  if (priority === "クリティカル" || normalized.includes("critical")) {
    return "クリティカル";
  }

  if (priority === "高" || normalized.includes("high")) {
    return "高";
  }

  if (priority === "中" || normalized.includes("medium")) {
    return "中";
  }

  if (priority === "低" || normalized.includes("low")) {
    return "低";
  }

  return priority;
}

export function formatStatusLabel(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("resolved")) {
    return "解決済み";
  }

  if (normalized.includes("closed")) {
    return "完了";
  }

  if (normalized.includes("approved")) {
    return "承認済み";
  }

  if (normalized.includes("open")) {
    return "未対応";
  }

  if (normalized.includes("active")) {
    return "有効";
  }

  if (normalized.includes("progress")) {
    return "対応中";
  }

  if (normalized.includes("pending")) {
    return "保留中";
  }

  if (normalized.includes("waiting")) {
    return "待機中";
  }

  if (normalized.includes("rejected")) {
    return "却下";
  }

  if (normalized.includes("failed")) {
    return "失敗";
  }

  return status;
}

export function getPriorityVariant(priority: string): BadgeVariant {
  const normalized = priority.toLowerCase();

  if (
    normalized.includes("critical") ||
    normalized.includes("urgent") ||
    priority === "クリティカル"
  ) {
    return "error";
  }

  if (normalized.includes("high") || priority === "高") {
    return "warning";
  }

  if (normalized.includes("medium") || priority === "中") {
    return "info";
  }

  return "default";
}

export function getStatusVariant(status: string): BadgeVariant {
  const normalized = status.toLowerCase();

  if (
    normalized.includes("resolved") ||
    normalized.includes("closed") ||
    normalized.includes("approved")
  ) {
    return "success";
  }

  if (normalized.includes("open") || normalized.includes("active")) {
    return "warning";
  }

  if (normalized.includes("progress") || normalized.includes("pending")) {
    return "info";
  }

  if (normalized.includes("rejected") || normalized.includes("failed")) {
    return "error";
  }

  return "default";
}

export function resolveRecordFieldValue(
  fieldCode: string,
  value: unknown,
  fields: ReferenceFieldSource[] = [],
  referenceLabelsByField: ReferenceLabelsByField = {}
) {
  const matchedField = fields.find((field) => field.code === fieldCode);

  if (matchedField?.fieldType !== "master_ref") {
    return value;
  }

  if (typeof value === "string") {
    return referenceLabelsByField[fieldCode]?.[value] ?? value;
  }

  if (Array.isArray(value)) {
    const labels = value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => referenceLabelsByField[fieldCode]?.[item] ?? item);

    return labels.join(", ");
  }

  return value;
}

export function resolveRecordReferences<T extends AppRecord | null | undefined>(
  record: T,
  fields: ReferenceFieldSource[] = [],
  referenceLabelsByField: ReferenceLabelsByField = {}
): T {
  if (!record) {
    return record;
  }

  let hasResolvedValue = false;
  const nextData = Object.fromEntries(
    Object.entries(getRecordData(record)).map(([fieldCode, value]) => {
      const nextValue = resolveRecordFieldValue(
        fieldCode,
        value,
        fields,
        referenceLabelsByField
      );

      if (nextValue !== value) {
        hasResolvedValue = true;
      }

      return [fieldCode, nextValue];
    })
  );

  if (!hasResolvedValue) {
    return record;
  }

  return {
    ...record,
    data: nextData,
  } as T;
}

export function resolveRecordListReferences(
  records: AppRecord[],
  fields: ReferenceFieldSource[] = [],
  referenceLabelsByField: ReferenceLabelsByField = {}
) {
  return records.map((record) =>
    resolveRecordReferences(record, fields, referenceLabelsByField)
  );
}

export function buildReferenceRecordHref(
  basePath: string,
  appCode: string,
  tableCode: string,
  recordId: string
) {
  const searchParams = new URLSearchParams({ recordId });
  return `${basePath}/${appCode}/${tableCode}?${searchParams.toString()}`;
}

export function formatFieldValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export function getDisplayFields(record: AppRecord | null | undefined) {
  const data = getRecordData(record);
  const hiddenKeys = new Set([
    "subject",
    "title",
    "name",
    "description",
    "summary",
    "details",
  ]);

  return Object.entries(data)
    .filter(([key, value]) => !hiddenKeys.has(key) && value !== undefined && value !== null)
    .slice(0, 8);
}

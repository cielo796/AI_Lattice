import {
  formatFieldValue,
  formatStatusLabel,
  getRecordData,
  getRecordDescription,
  getRecordIdentifier,
  getRecordPriority,
  getRecordTitle,
} from "@/lib/runtime-records";
import type { AppField, AppView, FieldType } from "@/types/app";
import type { AppRecord } from "@/types/record";

export const RECORD_STATUS_FIELD_CODE = "__record_status";
export const UPDATED_AT_FIELD_CODE = "__updated_at";

export type ViewFilter = {
  fieldCode: string;
  operator: "equals" | "contains" | "not_empty";
  value?: string;
};

export type ViewSort = {
  fieldCode: string;
  direction: "asc" | "desc";
};

export type RecordGroup = {
  key: string;
  label: string;
  records: AppRecord[];
};

export type ChartBucket = RecordGroup & {
  value: number;
  percent: number;
};

const TITLE_FIELD_CODES = new Set([
  "subject",
  "title",
  "name",
  "description",
  "summary",
  "details",
]);

function getSettingsString(
  view: AppView | undefined,
  key: string
) {
  const value = view?.settingsJson?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function isAllowedFieldType(field: AppField, allowedTypes?: FieldType[]) {
  return !allowedTypes || allowedTypes.includes(field.fieldType);
}

export function getViewColumns(view: AppView | undefined, fields: AppField[]) {
  const columns = view?.settingsJson?.columns;
  const fieldCodes = new Set(fields.map((field) => field.code));
  const configuredColumns = Array.isArray(columns)
    ? columns.filter(
        (item): item is string => typeof item === "string" && fieldCodes.has(item)
      )
    : [];

  return configuredColumns.length > 0
    ? configuredColumns
    : fields.slice(0, 3).map((field) => field.code);
}

export function getViewSort(view: AppView | undefined): ViewSort | null {
  const sort = view?.settingsJson?.sort;

  if (!sort || typeof sort !== "object" || Array.isArray(sort)) {
    return null;
  }

  const sortSettings = sort as Record<string, unknown>;
  const fieldCode =
    typeof sortSettings.fieldCode === "string" ? sortSettings.fieldCode : "";
  if (!fieldCode) {
    return null;
  }

  return {
    fieldCode,
    direction: sortSettings.direction === "asc" ? "asc" : "desc",
  };
}

export function getViewFilters(view: AppView | undefined): ViewFilter[] {
  const filters = view?.settingsJson?.filters;

  if (!Array.isArray(filters)) {
    return [];
  }

  return filters.reduce<ViewFilter[]>((normalizedFilters, filter) => {
    if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
      return normalizedFilters;
    }

    const rawFilter = filter as Record<string, unknown>;
    const fieldCode =
      typeof rawFilter.fieldCode === "string" ? rawFilter.fieldCode : "";

    if (!fieldCode) {
      return normalizedFilters;
    }

    const operator: ViewFilter["operator"] =
      rawFilter.operator === "equals" || rawFilter.operator === "not_empty"
        ? rawFilter.operator
        : "contains";
    const value =
      typeof rawFilter.value === "string" ? rawFilter.value.trim() : "";

    normalizedFilters.push({ fieldCode, operator, value });
    return normalizedFilters;
  }, []);
}

export function getComparableValue(record: AppRecord, fieldCode: string) {
  if (fieldCode === RECORD_STATUS_FIELD_CODE) {
    return record.status;
  }

  if (fieldCode === UPDATED_AT_FIELD_CODE) {
    return record.updatedAt;
  }

  const value = getRecordData(record)[fieldCode];

  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
}

export function filterRecordsByView(records: AppRecord[], filters: ViewFilter[]) {
  if (filters.length === 0) {
    return records;
  }

  return records.filter((record) =>
    filters.every((filter) => {
      const value = getComparableValue(record, filter.fieldCode);
      const text = String(value).toLowerCase();
      const expected = (filter.value ?? "").toLowerCase();

      if (filter.operator === "not_empty") {
        return text.trim().length > 0;
      }

      if (filter.operator === "equals") {
        return text === expected;
      }

      return expected ? text.includes(expected) : true;
    })
  );
}

export function sortRecordsByView(records: AppRecord[], view: AppView | undefined) {
  const sort = getViewSort(view);

  if (!sort) {
    return records;
  }

  return [...records].sort((left, right) => {
    const leftValue = getComparableValue(left, sort.fieldCode);
    const rightValue = getComparableValue(right, sort.fieldCode);
    const direction = sort.direction === "asc" ? 1 : -1;

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction;
    }

    return String(leftValue).localeCompare(String(rightValue), "ja") * direction;
  });
}

export function applyViewQuery(
  records: AppRecord[],
  visibleColumnCodes: string[],
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return records;
  }

  return records.filter((record) => {
    const haystack = [
      getRecordIdentifier(record),
      getRecordTitle(record),
      getRecordDescription(record),
      getRecordPriority(record),
      record.status,
      ...visibleColumnCodes.map((fieldCode) =>
        formatFieldValue(getRecordData(record)[fieldCode])
      ),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function getVisibleFields(
  record: AppRecord,
  columnCodes: string[],
  fields: AppField[],
  limit = 3
) {
  const recordData = getRecordData(record);

  return columnCodes
    .filter((fieldCode) => !TITLE_FIELD_CODES.has(fieldCode))
    .map((fieldCode) => ({
      fieldCode,
      label: fields.find((field) => field.code === fieldCode)?.name ?? fieldCode,
      value: recordData[fieldCode],
    }))
    .filter(
      (item) =>
        item.value !== undefined &&
        item.value !== null &&
        String(item.value).trim().length > 0
    )
    .slice(0, limit);
}

export function getConfiguredFieldCode(
  view: AppView | undefined,
  fields: AppField[],
  settingKey: string,
  allowedTypes?: FieldType[]
) {
  const fieldCode = getSettingsString(view, settingKey);
  const field = fields.find((item) => item.code === fieldCode);

  return field && isAllowedFieldType(field, allowedTypes) ? field.code : "";
}

export function getGroupFieldCode(view: AppView | undefined, fields: AppField[]) {
  const configuredFieldCode = getConfiguredFieldCode(
    view,
    fields,
    "groupByFieldCode"
  );

  if (configuredFieldCode) {
    return configuredFieldCode;
  }

  return (
    fields.find((field) => ["status", "stage", "priority"].includes(field.code))
      ?.code ||
    fields.find((field) => field.fieldType === "select")?.code ||
    fields.find((field) => field.fieldType === "boolean")?.code ||
    RECORD_STATUS_FIELD_CODE
  );
}

export function getDateFieldCode(view: AppView | undefined, fields: AppField[]) {
  const configuredFieldCode = getConfiguredFieldCode(view, fields, "dateFieldCode", [
    "date",
    "datetime",
  ]);

  if (configuredFieldCode) {
    return configuredFieldCode;
  }

  return (
    fields.find((field) => field.fieldType === "date" || field.fieldType === "datetime")
      ?.code ?? UPDATED_AT_FIELD_CODE
  );
}

export function getMetricFieldCode(view: AppView | undefined, fields: AppField[]) {
  return (
    getConfiguredFieldCode(view, fields, "metricFieldCode", ["number"]) ||
    fields.find((field) => field.fieldType === "number")?.code ||
    ""
  );
}

export function getFieldDisplayLabel(fieldCode: string, fields: AppField[]) {
  if (fieldCode === RECORD_STATUS_FIELD_CODE) {
    return "ステータス";
  }

  if (fieldCode === UPDATED_AT_FIELD_CODE) {
    return "更新日";
  }

  return fields.find((field) => field.code === fieldCode)?.name ?? fieldCode;
}

function formatGroupValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "未設定";
  }

  if (typeof value === "boolean") {
    return value ? "はい" : "いいえ";
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "未設定";
  }

  return String(value);
}

export function getGroupLabel(record: AppRecord, fieldCode: string) {
  if (fieldCode === RECORD_STATUS_FIELD_CODE) {
    return formatStatusLabel(record.status);
  }

  if (fieldCode === UPDATED_AT_FIELD_CODE) {
    return record.updatedAt.slice(0, 10);
  }

  return formatGroupValue(getRecordData(record)[fieldCode]);
}

function getFieldOptions(field: AppField | undefined) {
  const options = field?.settingsJson?.options;

  return Array.isArray(options)
    ? options.filter((option): option is string => typeof option === "string")
    : [];
}

export function groupRecordsByField(
  records: AppRecord[],
  fieldCode: string,
  fields: AppField[]
): RecordGroup[] {
  const field = fields.find((item) => item.code === fieldCode);
  const groupsByLabel = new Map<string, AppRecord[]>();

  for (const option of getFieldOptions(field)) {
    groupsByLabel.set(option, []);
  }

  for (const record of records) {
    const label = getGroupLabel(record, fieldCode);
    groupsByLabel.set(label, [...(groupsByLabel.get(label) ?? []), record]);
  }

  return Array.from(groupsByLabel.entries())
    .map(([label, groupRecords]) => ({
      key: label,
      label,
      records: groupRecords,
    }))
    .filter((group) => group.records.length > 0 || group.label !== "未設定");
}

function getDateKey(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export function groupRecordsByDate(records: AppRecord[], fieldCode: string) {
  const groupsByDate = new Map<string, AppRecord[]>();

  for (const record of records) {
    const rawValue =
      fieldCode === UPDATED_AT_FIELD_CODE
        ? record.updatedAt
        : getRecordData(record)[fieldCode];
    const dateKey = getDateKey(rawValue) || "日付なし";

    groupsByDate.set(dateKey, [...(groupsByDate.get(dateKey) ?? []), record]);
  }

  return Array.from(groupsByDate.entries())
    .sort(([left], [right]) => {
      if (left === "日付なし") return 1;
      if (right === "日付なし") return -1;
      return left.localeCompare(right);
    })
    .map(([dateKey, groupRecords]) => ({
      key: dateKey,
      label: dateKey,
      records: groupRecords,
    }));
}

function getMetricValue(record: AppRecord, metricFieldCode: string) {
  if (!metricFieldCode) {
    return 1;
  }

  const value = getRecordData(record)[metricFieldCode];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function getChartBuckets(
  records: AppRecord[],
  fields: AppField[],
  view: AppView | undefined
): ChartBucket[] {
  const groupFieldCode = getGroupFieldCode(view, fields);
  const metricFieldCode = getMetricFieldCode(view, fields);
  const groups = groupRecordsByField(records, groupFieldCode, fields).filter(
    (group) => group.records.length > 0
  );
  const values = groups.map((group) => ({
    ...group,
    value: group.records.reduce(
      (total, record) => total + getMetricValue(record, metricFieldCode),
      0
    ),
  }));
  const maxValue = Math.max(...values.map((group) => group.value), 1);

  return values
    .sort((left, right) => right.value - left.value)
    .slice(0, 8)
    .map((group) => ({
      ...group,
      percent: Math.max(6, Math.round((group.value / maxValue) * 100)),
    }));
}

export function getNumericMetricValues(records: AppRecord[], metricFieldCode: string) {
  if (!metricFieldCode) {
    return [];
  }

  return records
    .map((record) => getRecordData(record)[metricFieldCode])
    .filter(
      (value): value is number => typeof value === "number" && Number.isFinite(value)
    );
}

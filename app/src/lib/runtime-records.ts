import type { AppRecord } from "@/types/record";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "ai";

export function getRecordData(record: AppRecord | null | undefined) {
  if (!record || !record.data || typeof record.data !== "object") {
    return {} as Record<string, unknown>;
  }

  return record.data as Record<string, unknown>;
}

function getStringValue(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function getRecordIdentifier(record: AppRecord | null | undefined) {
  const data = getRecordData(record);

  return (
    getStringValue(data, "ticket_id") ||
    getStringValue(data, "code") ||
    getStringValue(data, "id") ||
    record?.id ||
    "Record"
  );
}

export function getRecordTitle(record: AppRecord | null | undefined) {
  const data = getRecordData(record);

  return (
    getStringValue(data, "subject") ||
    getStringValue(data, "title") ||
    getStringValue(data, "name") ||
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
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return `${Math.floor(diffHours / 24)}d ago`;
}

export function formatDateTime(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(dateStr));
}

export function getPriorityVariant(priority: string): BadgeVariant {
  const normalized = priority.toLowerCase();

  if (
    normalized.includes("critical") ||
    normalized.includes("urgent") ||
    priority === "繧ｯ繝ｪ繝・ぅ繧ｫ繝ｫ"
  ) {
    return "error";
  }

  if (normalized.includes("high") || priority === "鬮・") {
    return "warning";
  }

  if (normalized.includes("medium") || priority === "荳ｭ") {
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

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
    "レコード"
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

export function formatFieldKey(key: string) {
  const labels: Record<string, string> = {
    ticket_id: "チケット ID",
    code: "コード",
    id: "ID",
    status: "ステータス",
    priority: "優先度",
    customer: "顧客",
    requester: "依頼者",
    account: "アカウント",
    assignee: "担当者",
    sentiment_score: "感情スコア",
    created_at: "作成日時",
    updated_at: "更新日時",
  };

  return labels[key] ?? key.replace(/[_-]+/g, " ");
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

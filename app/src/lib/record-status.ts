export type StatusKind = "neutral" | "warning" | "success" | "danger";

const SUCCESS_KEYWORDS = [
  "完了",
  "承認済み",
  "解決済み",
  "approved",
  "done",
  "completed",
  "closed",
  "resolved",
] as const;

const WARNING_KEYWORDS = [
  "要確認",
  "承認待ち",
  "差戻し",
  "差し戻し",
  "pending",
  "review",
  "returned",
] as const;

const DANGER_KEYWORDS = [
  "却下",
  "rejected",
  "error",
  "failed",
  "canceled",
  "cancelled",
] as const;

function matchesAny(value: string, keywords: readonly string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

export function getStatusKind(status: string | null | undefined): StatusKind {
  const normalized = (status ?? "").trim().toLowerCase();

  if (!normalized) {
    return "neutral";
  }

  if (matchesAny(normalized, DANGER_KEYWORDS)) {
    return "danger";
  }

  if (matchesAny(normalized, WARNING_KEYWORDS)) {
    return "warning";
  }

  if (normalized.startsWith("未")) {
    return "neutral";
  }

  if (matchesAny(normalized, SUCCESS_KEYWORDS)) {
    return "success";
  }

  return "neutral";
}

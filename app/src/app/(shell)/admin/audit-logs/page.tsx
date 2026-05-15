"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { TopBar } from "@/components/shared/TopBar";
import { cn } from "@/lib/cn";
import { listAuditLogs } from "@/lib/api/audit";
import type { AuditLog } from "@/types/audit";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "ai";

const ACTION_LABELS: Record<string, string> = {
  APP_CREATE: "アプリ作成",
  APP_UPDATE: "アプリ更新",
  APP_DELETE: "アプリ削除",
  TABLE_CREATE: "テーブル作成",
  TABLE_UPDATE: "テーブル更新",
  TABLE_DELETE: "テーブル削除",
  FIELD_CREATE: "フィールド作成",
  FIELD_UPDATE: "フィールド更新",
  FIELD_DELETE: "フィールド削除",
  RECORD_CREATE: "レコード作成",
  RECORD_UPDATE: "レコード更新",
  RECORD_DELETE: "レコード削除",
  COMMENT_CREATE: "コメント追加",
  ATTACHMENT_CREATE: "添付追加",
  ATTACHMENT_DELETE: "添付削除",
  APP_GENERATE: "AI 生成",
  OPENAI_API_KEY_UPDATE: "OpenAI キー更新",
  OPENAI_API_KEY_CLEAR: "OpenAI キー削除",
  AUTH_LOGIN: "ログイン",
  AUTH_LOGOUT: "ログアウト",
};

const RESOURCE_LABELS: Record<string, string> = {
  app: "アプリ",
  table: "テーブル",
  field: "フィールド",
  record: "レコード",
  comment: "コメント",
  attachment: "添付",
  auth: "認証",
  ai: "AI",
  ai_settings: "AI 設定",
};

function getResultVariant(result: AuditLog["result"]): BadgeVariant {
  if (result === "denied") {
    return "warning";
  }

  if (result === "error") {
    return "error";
  }

  return "success";
}

function getResultLabel(result: AuditLog["result"]) {
  if (result === "denied") {
    return "拒否";
  }

  if (result === "error") {
    return "失敗";
  }

  return "成功";
}

function getActionVariant(log: AuditLog): BadgeVariant {
  if (log.result === "denied" || log.result === "error") {
    return getResultVariant(log.result);
  }

  const actionType = log.actionType;

  if (actionType.includes("DELETE")) {
    return "error";
  }

  if (actionType.includes("CREATE")) {
    return "success";
  }

  if (actionType.includes("UPDATE")) {
    return "info";
  }

  if (actionType.startsWith("AUTH")) {
    return "default";
  }

  return "warning";
}

function formatAction(actionType: string) {
  return ACTION_LABELS[actionType] ?? actionType;
}

function formatResource(resourceType: string) {
  return RESOURCE_LABELS[resourceType] ?? resourceType;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function getDetailSummary(log: AuditLog) {
  const detail = log.detailJson;

  if (!detail) {
    return log.resourceName ?? log.resourceId ?? "-";
  }

  if (typeof detail.tableCode === "string") {
    return detail.tableCode;
  }

  if (typeof detail.code === "string") {
    return detail.code;
  }

  if (typeof detail.status === "string") {
    return detail.status;
  }

  return log.resourceName ?? log.resourceId ?? "-";
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      try {
        setIsLoading(true);
        const nextLogs = await listAuditLogs({ limit: 100 });

        if (cancelled) {
          return;
        }

        setLogs(nextLogs);
        setSelectedId((current) =>
          current && nextLogs.some((log) => log.id === current)
            ? current
            : (nextLogs[0]?.id ?? null)
        );
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setLogs([]);
          setSelectedId(null);
          setError(
            nextError instanceof Error
              ? nextError.message
              : "監査ログの読み込みに失敗しました。"
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadLogs();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const selected = useMemo(
    () => logs.find((log) => log.id === selectedId) ?? null,
    [logs, selectedId]
  );
  const aiLogCount = logs.filter(
    (log) => log.aiInvolvement && log.aiInvolvement !== "none"
  ).length;
  const mutationCount = logs.filter((log) =>
    /CREATE|UPDATE|DELETE/.test(log.actionType)
  ).length;

  return (
    <>
      <TopBar
        title="監査ログ"
        breadcrumbs={[{ label: "管理" }, { label: "監査ログ" }]}
        actions={
          <Button
            variant="ghost"
            size="md"
            onClick={() => setRefreshKey((current) => current + 1)}
            disabled={isLoading}
          >
            <Icon name="sync" size="sm" />
            {isLoading ? "更新中..." : "更新"}
          </Button>
        }
      />

      <main className="mx-auto max-w-7xl px-6 pt-20 pb-10 md:px-10">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              表示件数
            </div>
            <div className="font-headline text-2xl font-bold tracking-tight text-on-surface">
              {logs.length}
            </div>
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              変更操作
            </div>
            <div className="font-headline text-2xl font-bold tracking-tight text-on-surface">
              {mutationCount}
            </div>
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              AI 関与
            </div>
            <div className="font-headline text-2xl font-bold tracking-tight text-primary">
              {aiLogCount}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-error-container bg-error-container/40 px-4 py-3 text-sm text-on-error-container">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="hidden grid-cols-[140px_180px_150px_1fr] gap-4 border-b border-outline-variant px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted md:grid">
              <div>時刻</div>
              <div>ユーザー</div>
              <div>操作</div>
              <div>対象</div>
            </div>

            {isLoading && logs.length === 0 ? (
              <div className="px-6 py-6 text-sm text-on-surface-variant">
                監査ログを読み込んでいます...
              </div>
            ) : logs.length === 0 ? (
              <div className="m-5 rounded-xl border-2 border-dashed border-outline-variant bg-surface p-10 text-center text-sm text-on-surface-variant">
                監査ログはまだありません。
              </div>
            ) : (
              <div className="divide-y divide-outline-variant">
                {logs.map((log) => (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => setSelectedId(log.id)}
                    className={cn(
                      "grid w-full grid-cols-1 gap-2 px-4 py-4 text-left transition-colors md:grid-cols-[140px_180px_150px_1fr] md:gap-4 md:px-6 md:items-center",
                      selected?.id === log.id
                        ? "bg-surface-container-high"
                        : "hover:bg-surface-container-low"
                    )}
                  >
                    <div className="font-mono text-xs text-on-surface-variant">
                      {formatTimestamp(log.createdAt)}
                    </div>
                    <div className="truncate text-sm font-semibold text-on-surface">
                      {log.actorName}
                    </div>
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant={getActionVariant(log)}
                          className="text-[9px]"
                        >
                          {formatAction(log.actionType)}
                        </Badge>
                        <Badge
                          variant={getResultVariant(log.result ?? "success")}
                          className="text-[9px]"
                        >
                          {getResultLabel(log.result ?? "success")}
                        </Badge>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-on-surface">
                        {log.resourceName ?? log.resourceId ?? "-"}
                      </div>
                      <div className="truncate font-mono text-[11px] text-on-surface-variant">
                        {formatResource(log.resourceType)} / {getDetailSummary(log)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="rounded-xl border border-outline-variant bg-surface p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            {selected ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                      イベント詳細
                    </div>
                    <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
                      {formatAction(selected.actionType)}
                    </h2>
                  </div>
                  <span className="font-mono text-[10px] text-on-surface-muted">
                    {selected.id}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-surface-container-high p-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                      ユーザー
                    </div>
                    <div className="truncate text-on-surface">{selected.actorName}</div>
                  </div>
                  <div className="rounded-lg bg-surface-container-high p-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                      結果
                    </div>
                    <Badge variant={getResultVariant(selected.result ?? "success")}>
                      {getResultLabel(selected.result ?? "success")}
                    </Badge>
                  </div>
                  <div className="rounded-lg bg-surface-container-high p-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                      対象
                    </div>
                    <div className="truncate text-on-surface">
                      {formatResource(selected.resourceType)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface-container-high p-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                      AI
                    </div>
                    <Badge
                      variant={
                        selected.aiInvolvement &&
                        selected.aiInvolvement !== "none"
                          ? "ai"
                          : "default"
                      }
                    >
                      {selected.aiInvolvement ?? "none"}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                    メタデータ
                  </div>
                  <pre className="max-h-[520px] overflow-auto rounded-lg border border-outline-variant bg-surface-container-low p-3 text-[10px] text-on-surface-variant">
{JSON.stringify(
  {
    actionType: selected.actionType,
    resourceType: selected.resourceType,
    resourceId: selected.resourceId,
    resourceName: selected.resourceName,
    actorId: selected.actorId,
    createdAt: selected.createdAt,
    detailJson: selected.detailJson,
  },
  null,
  2
)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-sm text-on-surface-variant">
                表示するイベントを選択してください。
              </div>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}

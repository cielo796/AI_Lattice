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

      <main className="mx-auto max-w-[1800px] px-4 py-10 pt-24 md:px-10">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-surface-container p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              表示件数
            </div>
            <div className="font-headline text-2xl font-bold text-white">
              {logs.length}
            </div>
          </div>
          <div className="rounded-lg bg-surface-container p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              変更操作
            </div>
            <div className="font-headline text-2xl font-bold text-white">
              {mutationCount}
            </div>
          </div>
          <div className="rounded-lg bg-surface-container p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              AI 関与
            </div>
            <div className="font-headline text-2xl font-bold text-primary">
              {aiLogCount}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
          <div className="overflow-hidden rounded-xl bg-surface-container">
            <div className="hidden grid-cols-[140px_180px_150px_1fr] gap-4 px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant md:grid">
              <div>時刻</div>
              <div>ユーザー</div>
              <div>操作</div>
              <div>対象</div>
            </div>

            {isLoading && logs.length === 0 ? (
              <div className="px-6 py-10 text-sm text-on-surface-variant">
                監査ログを読み込んでいます...
              </div>
            ) : logs.length === 0 ? (
              <div className="px-6 py-10 text-sm text-on-surface-variant">
                監査ログはまだありません。
              </div>
            ) : (
              logs.map((log) => (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => setSelectedId(log.id)}
                  className={cn(
                    "grid w-full grid-cols-1 gap-2 px-4 py-4 text-left transition-colors md:grid-cols-[140px_180px_150px_1fr] md:gap-4 md:px-6 md:items-center",
                    selected?.id === log.id
                      ? "bg-surface-container-high"
                      : "hover:bg-surface-container-high/50"
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
              ))
            )}
          </div>

          <aside className="rounded-xl bg-surface-container p-6">
            {selected ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      イベント詳細
                    </div>
                    <h2 className="font-headline text-xl font-bold text-white">
                      {formatAction(selected.actionType)}
                    </h2>
                  </div>
                  <span className="font-mono text-[10px] text-on-surface-variant">
                    {selected.id}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-surface-container-high p-3">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      ユーザー
                    </div>
                    <div className="truncate text-on-surface">{selected.actorName}</div>
                  </div>
                  <div className="rounded-lg bg-surface-container-high p-3">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      結果
                    </div>
                    <Badge variant={getResultVariant(selected.result ?? "success")}>
                      {getResultLabel(selected.result ?? "success")}
                    </Badge>
                  </div>
                  <div className="rounded-lg bg-surface-container-high p-3">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      対象
                    </div>
                    <div className="truncate text-on-surface">
                      {formatResource(selected.resourceType)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface-container-high p-3">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
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
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    メタデータ
                  </div>
                  <pre className="max-h-[520px] overflow-auto rounded-lg bg-surface-container-low p-3 text-[10px] text-on-surface-variant">
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

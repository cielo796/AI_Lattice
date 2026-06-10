"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { TopBar } from "@/components/shared/TopBar";
import { cn } from "@/lib/cn";
import { listAIExecutionLogs } from "@/lib/api/ai-logs";
import type { AIExecutionLog } from "@/types/ai";

type StatusFilter = AIExecutionLog["status"] | "all";
type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "ai";

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "success", label: "成功" },
  { value: "error", label: "失敗" },
];

const statusLabels: Record<AIExecutionLog["status"], string> = {
  success: "成功",
  error: "失敗",
};

const operationLabels: Record<string, string> = {
  "app_blueprint.generate": "アプリ生成",
  "app_blueprint.repair": "生成修復",
  "app_refinement.preview": "AI修正案",
};

function getStatusVariant(status: AIExecutionLog["status"]): BadgeVariant {
  return status === "success" ? "success" : "error";
}

function formatOperation(operation: string) {
  return operationLabels[operation] ?? operation;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatDuration(value: number | undefined) {
  if (value === undefined) {
    return "-";
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }

  return `${value}ms`;
}

function getInputSummary(log: AIExecutionLog) {
  const metadata = log.inputJson?.metadata;

  if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    "inputLength" in metadata &&
    typeof metadata.inputLength === "number"
  ) {
    return `${metadata.inputLength.toLocaleString("ja-JP")} chars`;
  }

  const input = log.inputJson?.input;
  return typeof input === "string"
    ? `${input.length.toLocaleString("ja-JP")} chars`
    : "-";
}

export default function AIExecutionLogsPage() {
  const [logs, setLogs] = useState<AIExecutionLog[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => logs.find((log) => log.id === selectedId) ?? logs[0] ?? null,
    [logs, selectedId]
  );
  const successCount = logs.filter((log) => log.status === "success").length;
  const errorCount = logs.filter((log) => log.status === "error").length;
  const totalTokens = logs.reduce((total, log) => total + log.totalTokens, 0);

  async function loadLogs(nextStatus = status) {
    try {
      setIsLoading(true);
      const nextLogs = await listAIExecutionLogs({
        limit: 100,
        status: nextStatus,
      });

      setLogs(nextLogs);
      setSelectedId((current) =>
        nextLogs.some((log) => log.id === current)
          ? current
          : nextLogs[0]?.id ?? ""
      );
      setError(null);
    } catch (nextError) {
      setLogs([]);
      setSelectedId("");
      setError(
        nextError instanceof Error
          ? nextError.message
          : "AI実行ログの読み込みに失敗しました。"
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <>
      <TopBar
        title="AI実行ログ"
        breadcrumbs={[{ label: "管理" }, { label: "AI実行ログ" }]}
        actions={
          <Button
            variant="ghost"
            size="md"
            onClick={() => void loadLogs()}
            disabled={isLoading}
          >
            <Icon name="refresh" size="sm" />
            更新
          </Button>
        }
      />

      <main className="mx-auto max-w-7xl px-6 pt-20 pb-10 md:px-10">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              表示件数
            </div>
            <div className="mt-2 font-headline text-3xl font-bold tracking-tight text-on-surface">
              {logs.length}
            </div>
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              成功
            </div>
            <div className="mt-2 font-headline text-3xl font-bold tracking-tight text-success">
              {successCount}
            </div>
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              失敗
            </div>
            <div className="mt-2 font-headline text-3xl font-bold tracking-tight text-error">
              {errorCount}
            </div>
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              Tokens
            </div>
            <div className="mt-2 font-headline text-3xl font-bold tracking-tight text-primary">
              {totalTokens.toLocaleString("ja-JP")}
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {statusFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setStatus(item.value)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                status === item.value
                  ? "bg-primary text-white"
                  : "border border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-error-container bg-error-container/40 p-3 text-sm text-on-error-container">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="grid grid-cols-[1fr_92px_96px] gap-3 border-b border-outline-variant px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted md:grid-cols-[150px_1fr_120px_100px_100px]">
              <span className="hidden md:block">時刻</span>
              <span>操作</span>
              <span>状態</span>
              <span>Model</span>
              <span>Tokens</span>
            </div>

            {isLoading ? (
              <div className="p-6 text-sm text-on-surface-variant">読み込み中...</div>
            ) : logs.length === 0 ? (
              <div className="m-5 rounded-xl border-2 border-dashed border-outline-variant bg-surface p-10 text-center text-sm text-on-surface-variant">
                AI実行ログはまだありません。
              </div>
            ) : (
              <div className="divide-y divide-outline-variant">
                {logs.map((log) => (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => setSelectedId(log.id)}
                    className={cn(
                      "grid w-full grid-cols-[1fr_92px_96px] items-center gap-3 px-4 py-4 text-left transition-colors md:grid-cols-[150px_1fr_120px_100px_100px] md:px-5",
                      selected?.id === log.id
                        ? "bg-surface-container-high"
                        : "hover:bg-surface-container-low"
                    )}
                  >
                    <div className="hidden font-mono text-xs text-on-surface-variant md:block">
                      {formatDateTime(log.createdAt)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-on-surface">
                        {formatOperation(log.operation)}
                      </div>
                      <div className="truncate text-[11px] text-on-surface-variant">
                        {log.appName ?? log.appCode ?? log.actorName ?? log.actorId}
                      </div>
                    </div>
                    <div>
                      <Badge variant={getStatusVariant(log.status)}>
                        {statusLabels[log.status]}
                      </Badge>
                    </div>
                    <div className="truncate font-mono text-xs text-on-surface-variant">
                      {log.modelName}
                    </div>
                    <div className="font-mono text-xs text-on-surface-variant">
                      {log.totalTokens.toLocaleString("ja-JP")}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="rounded-xl border border-outline-variant bg-surface p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            {selected ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                      実行詳細
                    </div>
                    <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
                      {formatOperation(selected.operation)}
                    </h2>
                  </div>
                  <Badge variant={getStatusVariant(selected.status)}>
                    {statusLabels[selected.status]}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-surface-container-high p-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                      Provider
                    </div>
                    <div className="truncate text-on-surface">{selected.provider}</div>
                  </div>
                  <div className="rounded-lg bg-surface-container-high p-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                      Duration
                    </div>
                    <div className="font-mono text-on-surface">
                      {formatDuration(selected.durationMs)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface-container-high p-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                      Input
                    </div>
                    <div className="font-mono text-on-surface">
                      {getInputSummary(selected)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface-container-high p-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                      Tokens
                    </div>
                    <div className="font-mono text-on-surface">
                      {selected.totalTokens.toLocaleString("ja-JP")}
                    </div>
                  </div>
                </div>

                {selected.errorMessage && (
                  <div className="rounded-lg border border-error-container bg-error-container/40 p-3 text-sm text-on-error-container">
                    {selected.errorMessage}
                  </div>
                )}

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                    メタデータ
                  </div>
                  <pre className="max-h-[520px] overflow-auto rounded-lg border border-outline-variant bg-surface-container-low p-3 text-[10px] text-on-surface-variant">
{JSON.stringify(
  {
    id: selected.id,
    operation: selected.operation,
    modelName: selected.modelName,
    appId: selected.appId,
    recordId: selected.recordId,
    actorId: selected.actorId,
    promptTemplateVersionId: selected.promptTemplateVersionId,
    promptTokens: selected.promptTokens,
    completionTokens: selected.completionTokens,
    totalTokens: selected.totalTokens,
    inputJson: selected.inputJson,
    outputJson: selected.outputJson,
  },
  null,
  2
)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-sm text-on-surface-variant">
                表示するログを選択してください。
              </div>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}

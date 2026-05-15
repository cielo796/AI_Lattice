"use client";

import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { Badge } from "@/components/shared/Badge";
import { cn } from "@/lib/cn";
import {
  listApprovals,
  updateApprovalDecision,
} from "@/lib/api/approvals";
import type { Approval } from "@/types/record";

type ApprovalFilter = Approval["status"] | "all";

const statusLabels: Record<Approval["status"], string> = {
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下",
};

const statusVariants: Record<
  Approval["status"],
  "default" | "success" | "warning" | "error" | "info" | "ai"
> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

const filters: Array<{ value: ApprovalFilter; label: string }> = [
  { value: "pending", label: "承認待ち" },
  { value: "all", label: "すべて" },
  { value: "approved", label: "承認済み" },
  { value: "rejected", label: "却下" },
];

function formatDateTime(value: string | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<ApprovalFilter>("pending");
  const [commentText, setCommentText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = useMemo(
    () => approvals.find((approval) => approval.id === selectedId) ?? approvals[0] ?? null,
    [approvals, selectedId]
  );
  const pendingCount = approvals.filter((approval) => approval.status === "pending").length;

  async function loadApprovals(nextFilter = filter) {
    try {
      setIsLoading(true);
      const nextApprovals = await listApprovals({
        status: nextFilter,
        limit: 100,
      });

      setApprovals(nextApprovals);
      setSelectedId((current) =>
        nextApprovals.some((approval) => approval.id === current)
          ? current
          : nextApprovals[0]?.id ?? ""
      );
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "承認一覧の読み込みに失敗しました。"
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadApprovals(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function decide(status: "approved" | "rejected") {
    if (!selected) {
      return;
    }

    try {
      setIsSaving(true);
      const updated = await updateApprovalDecision(selected.id, {
        status,
        commentText,
      });

      setApprovals((current) =>
        current
          .map((approval) => (approval.id === updated.id ? updated : approval))
          .filter((approval) => filter === "all" || approval.status === filter)
      );
      setCommentText("");
      setNotice(status === "approved" ? "承認しました。" : "却下しました。");
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "承認ステータスの更新に失敗しました。"
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <TopBar
        title="承認"
        breadcrumbs={[
          { label: "ダッシュボード" },
          { label: "管理" },
          { label: "承認" },
        ]}
        actions={
          <Button
            variant="ghost"
            size="md"
            onClick={() => void loadApprovals()}
            disabled={isLoading}
          >
            <Icon name="refresh" size="sm" />
            更新
          </Button>
        }
      />

      <main className="mx-auto max-w-7xl px-6 pt-20 pb-10 md:px-10">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              承認待ち
            </div>
            <div className="mt-2 font-headline text-3xl font-bold tracking-tight text-on-surface">
              {pendingCount}
            </div>
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              表示中
            </div>
            <div className="mt-2 font-headline text-3xl font-bold tracking-tight text-on-surface">
              {approvals.length}
            </div>
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              選択中
            </div>
            <div className="mt-2 truncate text-lg font-semibold text-on-surface">
              {selected?.title ?? "-"}
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                filter === item.value
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
        {notice && (
          <div className="mb-4 rounded-lg border border-tertiary-container bg-primary-container p-3 text-sm text-on-primary-container">
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="grid grid-cols-[1fr_120px_150px] gap-4 border-b border-outline-variant px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted md:grid-cols-[1.4fr_1fr_130px_150px]">
              <span>承認</span>
              <span className="hidden md:block">対象</span>
              <span>状態</span>
              <span>作成</span>
            </div>

            {isLoading ? (
              <div className="p-6 text-sm text-on-surface-variant">読み込み中...</div>
            ) : approvals.length === 0 ? (
              <div className="m-5 rounded-xl border-2 border-dashed border-outline-variant bg-surface p-10 text-center text-sm text-on-surface-variant">
                対象の承認はありません。
              </div>
            ) : (
              <div className="divide-y divide-outline-variant">
                {approvals.map((approval) => (
                  <button
                    key={approval.id}
                    type="button"
                    onClick={() => setSelectedId(approval.id)}
                    className={cn(
                      "grid w-full grid-cols-[1fr_120px_150px] gap-4 px-5 py-4 text-left transition-colors md:grid-cols-[1.4fr_1fr_130px_150px]",
                      selected?.id === approval.id
                        ? "bg-surface-container-high"
                        : "hover:bg-surface-container-low"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-on-surface">
                        {approval.title}
                      </div>
                      <div className="mt-1 truncate text-xs text-on-surface-variant">
                        {approval.workflowName ?? "手動承認"} /{" "}
                        {approval.requesterName ?? approval.requestedBy}
                      </div>
                    </div>
                    <div className="hidden min-w-0 text-xs text-on-surface-variant md:block">
                      <div className="truncate">{approval.appName ?? approval.appId}</div>
                      <div className="truncate">{approval.recordTitle ?? approval.recordId}</div>
                    </div>
                    <div>
                      <Badge variant={statusVariants[approval.status]}>
                        {statusLabels[approval.status]}
                      </Badge>
                    </div>
                    <div className="text-xs text-on-surface-variant">
                      {formatDateTime(approval.createdAt)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="rounded-xl border border-outline-variant bg-surface p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            {selected ? (
              <div className="space-y-6">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <Badge variant={statusVariants[selected.status]}>
                      {statusLabels[selected.status]}
                    </Badge>
                    <span className="text-xs text-on-surface-variant">
                      {formatDateTime(selected.createdAt)}
                    </span>
                  </div>
                  <h1 className="font-headline text-xl font-bold tracking-tight text-on-surface">
                    {selected.title}
                  </h1>
                  {selected.description && (
                    <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                      {selected.description}
                    </p>
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-on-surface-variant">アプリ</span>
                    <span className="text-right font-semibold text-on-surface">
                      {selected.appName ?? selected.appId}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-on-surface-variant">テーブル</span>
                    <span className="text-right font-semibold text-on-surface">
                      {selected.tableName ?? selected.tableId}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-on-surface-variant">レコード</span>
                    <span className="text-right font-semibold text-on-surface">
                      {selected.recordTitle ?? selected.recordId}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-on-surface-variant">承認者</span>
                    <span className="text-right font-semibold text-on-surface">
                      {selected.approverName ?? selected.approverId}
                    </span>
                  </div>
                </div>

                {selected.status === "pending" ? (
                  <div className="space-y-3">
                    <textarea
                      value={commentText}
                      onChange={(event) => setCommentText(event.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-lg border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="判断コメント"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => void decide("approved")}
                        disabled={isSaving}
                      >
                        <Icon name="check" size="sm" />
                        承認
                      </Button>
                      <Button
                        variant="danger"
                        size="md"
                        onClick={() => void decide("rejected")}
                        disabled={isSaving}
                      >
                        <Icon name="close" size="sm" />
                        却下
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-surface-container-high p-4 text-sm text-on-surface-variant">
                    {selected.actorName ?? selected.actedBy ?? "承認者"} が{" "}
                    {formatDateTime(selected.actedAt)} に判断しました。
                    {selected.commentText && (
                      <div className="mt-3 text-on-surface">{selected.commentText}</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-on-surface-variant">
                承認を選択してください。
              </div>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}

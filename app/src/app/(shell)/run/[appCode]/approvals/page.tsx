"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { TopBar } from "@/components/shared/TopBar";
import { cn } from "@/lib/cn";
import {
  listRuntimeApprovals,
  updateApprovalDecision,
} from "@/lib/api/approvals";
import type { Approval } from "@/types/record";

type Filter = Approval["status"] | "all";

const labels: Record<Approval["status"], string> = {
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下",
};

export default function RuntimeApprovalsPage({ params }: { params: Promise<{ appCode: string }> }) {
  const { appCode } = use(params);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [selectedId, setSelectedId] = useState("");
  const [commentText, setCommentText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selected = useMemo(
    () => approvals.find((item) => item.id === selectedId) ?? approvals[0] ?? null,
    [approvals, selectedId]
  );

  async function load(nextFilter = filter) {
    try {
      setIsLoading(true);
      const items = await listRuntimeApprovals(appCode, { status: nextFilter, limit: 100 });
      setApprovals(items);
      setSelectedId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "承認一覧の読み込みに失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, appCode]);

  async function decide(status: "approved" | "rejected") {
    if (!selected) return;
    try {
      const updated = await updateApprovalDecision(selected.id, { status, commentText });
      setApprovals((current) => current.map((item) => item.id === updated.id ? updated : item).filter((item) => filter === "all" || item.status === filter));
      setCommentText("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "承認処理に失敗しました。");
    }
  }

  return (
    <>
      <TopBar title="承認" breadcrumbs={[{ label: appCode }, { label: "承認" }]} />
      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-16 pt-24 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="font-headline text-xl font-extrabold text-on-surface">承認待ち一覧</h1><p className="mt-1 text-xs text-on-surface-variant">このアプリの承認のみ表示します。</p></div>
          <Button variant="ghost" onClick={() => void load()} disabled={isLoading}><Icon name="refresh" size="sm" />更新</Button>
        </div>
        <div className="flex gap-2">
          {(["pending", "all", "approved", "rejected"] as Filter[]).map((value) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={cn("rounded-md px-3 py-2 text-xs font-semibold", filter === value ? "bg-primary text-white" : "border border-outline-variant bg-surface text-on-surface-variant")}>
              {value === "all" ? "すべて" : labels[value]}
            </button>
          ))}
        </div>
        {error && <div className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="divide-y divide-outline-variant overflow-hidden rounded-lg border border-outline-variant bg-surface">
            {isLoading ? <div className="px-4 py-10 text-center text-sm text-on-surface-variant">読み込み中...</div> : approvals.length === 0 ? <div className="px-4 py-10 text-center text-sm text-on-surface-variant">対象の承認はありません。</div> : approvals.map((approval) => (
              <button key={approval.id} type="button" onClick={() => setSelectedId(approval.id)} className={cn("flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-surface-container-low", selected?.id === approval.id && "bg-surface-container-high")}>
                <div className="min-w-0 flex-1"><div className="truncate font-semibold text-on-surface">{approval.title}</div><div className="mt-1 truncate text-xs text-on-surface-variant">{approval.tableName} / {approval.recordTitle}</div></div>
                <Badge variant={approval.status === "pending" ? "warning" : approval.status === "approved" ? "success" : "error"}>{labels[approval.status]}</Badge>
              </button>
            ))}
          </section>
          <aside className="rounded-lg border border-outline-variant bg-surface p-5">
            {selected ? <div className="space-y-4"><div><Badge variant={selected.status === "pending" ? "warning" : selected.status === "approved" ? "success" : "error"}>{labels[selected.status]}</Badge><h2 className="mt-3 font-headline text-lg font-bold text-on-surface">{selected.title}</h2><p className="mt-2 text-sm text-on-surface-variant">{selected.description}</p></div><div className="text-xs text-on-surface-variant">依頼者: {selected.requesterName ?? selected.requestedBy}<br />承認者: {selected.approverName ?? selected.approverId}</div>{selected.status === "pending" && <><textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} rows={4} placeholder="判断コメント" className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm" /><div className="flex gap-2"><Button onClick={() => void decide("approved")}><Icon name="check" size="sm" />承認</Button><Button variant="danger" onClick={() => void decide("rejected")}><Icon name="close" size="sm" />却下</Button></div></>}</div> : <div className="text-sm text-on-surface-variant">承認を選択してください。</div>}
          </aside>
        </div>
      </main>
    </>
  );
}


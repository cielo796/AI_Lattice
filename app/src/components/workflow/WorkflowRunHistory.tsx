"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { WorkflowRun } from "@/types/workflow";
import { Button } from "@/components/shared/Button";

const labels: Record<string, string> = {
  ready: "開始待ち", running: "実行中", waiting: "承認待ち", completed: "完了", failed: "失敗",
  success: "成功", failure: "失敗", skip: "未通過",
};

export function WorkflowRunHistory({ appId, workflowId }: { appId: string; workflowId: string }) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRuns(await apiFetch<WorkflowRun[]>(`/api/apps/${appId}/workflow-runs?workflowId=${encodeURIComponent(workflowId)}`));
      setError(null);
    } catch (error) { setError(error instanceof Error ? error.message : "実行履歴を読み込めませんでした。"); }
    finally { setLoading(false); }
  }, [appId, workflowId]);
  useEffect(() => { void load(); }, [load]);

  async function resume(runId: string) {
    setLoading(true);
    try {
      await apiFetch(`/api/apps/${appId}/workflow-runs/${runId}/resume`, { method: "POST" });
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : "再開できませんでした。"); }
    finally { setLoading(false); }
  }

  return <section aria-label="ワークフロー実行履歴" className="mt-4 rounded-xl border border-outline-variant bg-surface p-4 text-xs">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-semibold">実行履歴（最新100件）</h2>
      <Button size="sm" variant="ghost" disabled={loading} onClick={() => void load()}>更新</Button>
    </div>
    {error && <p role="alert" className="mb-2 text-error">{error}</p>}
    {loading && <p role="status">読み込み中...</p>}
    {!loading && runs.length === 0 && <p>実行履歴はまだありません。</p>}
    <div className="max-h-96 space-y-2 overflow-y-auto">
      {runs.map((run) => <details key={run.id} className="rounded border border-outline-variant p-2">
        <summary className="cursor-pointer">{labels[run.status]} · {new Date(run.createdAt).toLocaleString("ja-JP")}</summary>
        <p className="my-2 break-all text-on-surface-variant">レコード: {run.recordId}</p>
        {run.error && <p className="my-2 whitespace-pre-wrap text-error">{run.error}</p>}
        <ol className="space-y-1">
          {run.state.executions.map((step) => <li key={step.nodeId}>
            {step.nodeId}: {labels[step.status]}{step.outcome ? ` (${step.outcome})` : ""}
            {step.error && <p className="text-error">{step.error}</p>}
          </li>)}
        </ol>
        {["ready", "waiting"].includes(run.status) && <div className="mt-3 space-y-2">
          <p>承認判断済みの場合に再開できます。未判断の承認はスキップしません。</p>
          <Button size="sm" variant="secondary" disabled={loading} onClick={() => void resume(run.id)}>再開を確認</Button>
        </div>}
        {run.status === "running" && <p className="mt-2">長時間変化がない場合は管理者が実行先を確認してください。外部処理の二重実行を防ぐため、自動再実行はしません。</p>}
      </details>)}
    </div>
  </section>;
}

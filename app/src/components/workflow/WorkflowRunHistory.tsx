"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { WorkflowRecoveryInput, WorkflowRun } from "@/types/workflow";
import { Button } from "@/components/shared/Button";

const labels: Record<string, string> = {
  ready: "開始待ち", running: "実行中", waiting: "承認待ち", interrupted: "結果確認が必要", completed: "完了", failed: "失敗",
  success: "成功", failure: "失敗", skip: "未通過",
};

export function WorkflowRunHistory({ appId, workflowId, canManage = false }: { appId: string; workflowId: string; canManage?: boolean }) {
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

  async function recover(run: WorkflowRun, input: WorkflowRecoveryInput) {
    setLoading(true);
    try {
      await apiFetch(`/api/apps/${appId}/workflow-runs/${run.id}/recover`, { method: "POST", body: JSON.stringify(input) });
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : "復旧判断を保存できませんでした。"); }
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
            <span>{step.nodeId}: {labels[step.status]}{step.outcome ? ` (${step.outcome})` : ""}</span>
            {step.error && <p className="text-error">{step.error}</p>}
          </li>)}
        </ol>
        {canManage && ["ready", "waiting"].includes(run.status) && <div className="mt-3 space-y-2">
          <p>承認判断済みの場合に再開できます。未判断の承認はスキップしません。</p>
          <Button size="sm" variant="secondary" disabled={loading} onClick={() => void resume(run.id)}>再開を確認</Button>
        </div>}
        {run.status === "running" && <p className="mt-2">停止した実行は5分の実行権期限後にworkerが確認します。DB内処理は回復できますが、結果が不明な外部API・AIは自動再送しません。</p>}
        {run.status === "interrupted" && (canManage
          ? <WorkflowRecoveryControls run={run} loading={loading} recover={recover} />
          : <p className="mt-2">ワークフロー管理権限のある利用者に、実行先の結果確認と復旧判断を依頼してください。</p>)}
      </details>)}
    </div>
  </section>;
}

function WorkflowRecoveryControls({ run, loading, recover }: { run: WorkflowRun; loading: boolean; recover: (run: WorkflowRun, input: WorkflowRecoveryInput) => Promise<void> }) {
  const [action, setAction] = useState<WorkflowRecoveryInput["action"]>("fail");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const confirmationRequired = action !== "fail";
  const label = { retry: "再試行", skip: "処理済みとして次へ", fail: "失敗として終了" }[action];
  return <form className="mt-3 space-y-2" onSubmit={(event) => {
    event.preventDefault();
    if (!window.confirm(`${label}を実行します。再試行は外部処理が重複する可能性があります。処理済みの場合は当該ノードを再実行せず、後続処理を進めます。続行しますか？`)) return;
    void recover(run, { action, reason, expectedUpdatedAt: run.updatedAt, confirmExternalOutcome: confirmed });
  }}>
    <p>API実行先・AI利用履歴を確認して判断してください。再試行は二重実行・二重課金の可能性があります。</p>
    <label className="block">復旧操作<select aria-label="復旧操作" className="ml-2 rounded border p-1" value={action} onChange={(event) => { setAction(event.target.value as WorkflowRecoveryInput["action"]); setConfirmed(false); }}>
      <option value="fail">失敗として終了</option><option value="retry">再試行</option><option value="skip">処理済みとして次へ</option>
    </select></label>
    <label className="block">判断理由<textarea aria-label="復旧判断の理由" className="mt-1 block w-full rounded border bg-surface p-2" value={reason} maxLength={1000} required onChange={(event) => setReason(event.target.value)} /></label>
    {confirmationRequired && <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} required onChange={(event) => setConfirmed(event.target.checked)} />外部処理の結果と重複リスクを確認しました</label>}
    <Button size="sm" variant="secondary" type="submit" disabled={loading || !reason.trim() || (confirmationRequired && !confirmed)}>{label}</Button>
  </form>;
}

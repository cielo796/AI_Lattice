"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { Button } from "@/components/shared/Button";
import type { WorkflowScheduleInfo } from "@/types/workflow";

export function WorkflowScheduleStatus({ appId, workflowId }: { appId: string; workflowId: string }) {
  const [state, setState] = useState<WorkflowScheduleInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(await apiFetch<WorkflowScheduleInfo>(`/api/apps/${appId}/workflows/${workflowId}/schedule`));
      setError(null);
    } catch (error) { setError(error instanceof Error ? error.message : "スケジュール状態を読み込めませんでした。"); }
    finally { setLoading(false); }
  }, [appId, workflowId]);
  useEffect(() => { void load(); }, [load]);

  return <section aria-label="スケジュール実行状態" className="space-y-2 rounded-xl border border-outline-variant p-3 text-xs">
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">スケジュール実行状態</h2><Button size="sm" variant="ghost" disabled={loading} onClick={() => void load()}>状態を更新</Button></div>
    {error && <p role="alert" className="text-error">{error}</p>}
    {loading && <p role="status">読み込み中...</p>}
    {state && <>
      <p>{state.workflowStatus === "draft" ? "下書き（定期登録は停止中）" : state.cycleInProgress ? "対象レコードの登録途中" : state.nextDueAt ? "次の周期を待機中" : "まだ定期登録されていません"}</p>
      {state.lastBatchAt && <p>最終登録処理: {new Date(state.lastBatchAt).toLocaleString("ja-JP")}</p>}
      {state.nextDueAt && <p>{state.lastError ? "再試行可能時刻" : state.cycleInProgress ? "継続可能時刻" : "次周期の開始可能時刻"}: {new Date(state.nextDueAt).toLocaleString("ja-JP")}</p>}
      {state.lastError && <p role="alert" className="whitespace-pre-wrap text-error">登録失敗: {state.lastError}</p>}
    </>}
    <p className="text-on-surface-variant">外部cronの設定が必要です。表示時刻以降のcron呼び出しで登録し、実際の処理は実行履歴で確認できます。</p>
  </section>;
}

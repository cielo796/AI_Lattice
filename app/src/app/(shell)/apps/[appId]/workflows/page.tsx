"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { WorkflowInspector, WorkflowField, workflowInputClass } from "@/components/workflow/WorkflowInspector";
import { WorkflowRunHistory } from "@/components/workflow/WorkflowRunHistory";
import { AICommandBar } from "@/components/workflow/AICommandBar";
import { createWorkflow, deleteWorkflow, getWorkflowEditorContext, listWorkflows, updateWorkflow } from "@/lib/api/workflows";
import { getCurrentPermissions } from "@/lib/api/rbac";
import { connectEditorNodes, createWorkflowTemplate, workflowBranchOptions, workflowTriggerLabels } from "@/lib/workflow-editor";
import { validateWorkflowGraph } from "@/lib/workflow-graph";
import { validateWorkflowReferences } from "@/lib/workflow-config";
import { cn } from "@/lib/cn";
import type { Workflow, WorkflowEditorContext } from "@/types/workflow";

type WorkflowDraft = Pick<Workflow, "id" | "name" | "triggerType" | "status" | "definitionJson">;

export default function WorkflowEditorPage() {
  const params = useParams();
  const appId = Array.isArray(params.appId) ? params.appId[0] : params.appId as string;
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState("");
  const [draft, setDraft] = useState<WorkflowDraft | null>(null);
  const [context, setContext] = useState<WorkflowEditorContext | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [template, setTemplate] = useState<"blank" | "approval">("blank");
  const [selection, setSelection] = useState<{ nodeId?: string; edgeId?: string }>({});
  const [connectSource, setConnectSource] = useState("");
  const [connectTarget, setConnectTarget] = useState("");
  const [connectBranch, setConnectBranch] = useState("");
  const activeWorkflow = workflows.find((workflow) => workflow.id === activeWorkflowId);
  const readOnly = !canManage || isSaving;
  const dirty = Boolean(draft && activeWorkflow && JSON.stringify(draft) !== JSON.stringify({ id: activeWorkflow.id, name: activeWorkflow.name, triggerType: activeWorkflow.triggerType, status: activeWorkflow.status, definitionJson: activeWorkflow.definitionJson }));
  const validationErrors = useMemo(() => draft ? [
    ...(!draft.name.trim() ? ["ワークフロー名を入力してください。"] : []),
    ...validateWorkflowGraph(draft.definitionJson, { active: true, triggerType: draft.triggerType }),
    ...(context ? validateWorkflowReferences(draft.definitionJson, context) : []),
  ] : [], [draft, context]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setCanManage(false);
    Promise.all([listWorkflows(appId), getWorkflowEditorContext(appId), getCurrentPermissions({ appId })]).then(([nextWorkflows, nextContext, permissions]) => {
      if (cancelled) return;
      setWorkflows(nextWorkflows);
      setActiveWorkflowId(nextWorkflows[0]?.id ?? "");
      setContext(nextContext);
      setCanManage(permissions["workflow:manage"] === true);
      setError(null);
    }).catch((nextError: unknown) => { if (!cancelled) setError(nextError instanceof Error ? nextError.message : "読み込みに失敗しました。"); }).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [appId]);

  useEffect(() => {
    setDraft(activeWorkflow ? { id: activeWorkflow.id, name: activeWorkflow.name, triggerType: activeWorkflow.triggerType, status: activeWorkflow.status, definitionJson: activeWorkflow.definitionJson } : null);
    setSelection({});
    setConnectSource("");
    setConnectTarget("");
    setConnectBranch("");
  }, [activeWorkflow]);

  useEffect(() => {
    if (!dirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [dirty]);

  function confirmDiscard() {
    return !dirty || window.confirm("未保存の変更を破棄しますか？");
  }

  function changeTriggerType(triggerType: Workflow["triggerType"]) {
    setDraft((current) => current ? { ...current, triggerType, definitionJson: { ...current.definitionJson, nodes: current.definitionJson.nodes.map((node) => node.data.nodeType === "trigger" ? { ...node, data: { ...node.data, config: { ...node.data.config, triggerType } } } : node) } } : null);
  }

  async function saveWorkflow(status = draft?.status ?? "draft") {
    if (!draft || readOnly) return;
    const errors = status === "active" ? validationErrors : [...(!draft.name.trim() ? ["ワークフロー名を入力してください。"] : []), ...validateWorkflowGraph(draft.definitionJson)];
    if (errors.length) { setError(errors.join("\n")); return; }
    try {
      setIsSaving(true);
      const updated = await updateWorkflow(appId, draft.id, { name: draft.name, triggerType: draft.triggerType, status, definitionJson: draft.definitionJson });
      setWorkflows((current) => current.map((workflow) => workflow.id === updated.id ? updated : workflow));
      setNotice(status === "active" ? "ワークフローを有効な状態で保存しました。" : "ワークフローを下書き保存しました。");
      setError(null);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "保存に失敗しました。"); }
    finally { setIsSaving(false); }
  }

  async function createNewWorkflow() {
    if (readOnly || !confirmDiscard()) return;
    try {
      setIsSaving(true);
      const created = await createWorkflow(appId, { name: `${template === "approval" ? "承認フロー" : "新しいワークフロー"} ${workflows.length + 1}`, triggerType: "update", status: "draft", definitionJson: createWorkflowTemplate(template) });
      setWorkflows((current) => [created, ...current]);
      setActiveWorkflowId(created.id);
      setNotice("ワークフローを作成しました。");
      setError(null);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "作成に失敗しました。"); }
    finally { setIsSaving(false); }
  }

  async function deleteCurrentWorkflow() {
    if (!activeWorkflow || readOnly || !window.confirm(`「${activeWorkflow.name}」を削除しますか？${dirty ? "未保存の変更も破棄されます。" : ""}`)) return;
    try {
      setIsSaving(true);
      await deleteWorkflow(appId, activeWorkflow.id);
      const remaining = workflows.filter((workflow) => workflow.id !== activeWorkflow.id);
      setWorkflows(remaining);
      setActiveWorkflowId(remaining[0]?.id ?? "");
      setNotice("ワークフローを削除しました。");
      setError(null);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "削除に失敗しました。"); }
    finally { setIsSaving(false); }
  }

  return <>
    <TopBar breadcrumbs={[{ label: "ダッシュボード" }, { label: "ワークフロー自動化エディタ" }]} actions={<div className="flex items-center gap-2" data-guide="workflow-save-actions">
      {dirty && <Badge variant="warning">未保存</Badge>}
      <Button variant="secondary" onClick={() => void saveWorkflow()} disabled={!draft || readOnly}>保存</Button>
      <Button onClick={() => void saveWorkflow("active")} disabled={!draft || readOnly || !context}>有効化</Button>
    </div>} />
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col pt-14 xl:flex-row">
      <aside className="w-full shrink-0 border-b border-outline-variant bg-sidebar p-4 xl:w-64 xl:border-r" data-guide="workflow-list">
        <h1 className="mb-3 text-sm font-bold text-on-surface">ワークフロー</h1>
        <div className="mb-4 space-y-2">
          <WorkflowField label="新規テンプレート"><select value={template} disabled={readOnly} onChange={(event) => setTemplate(event.target.value as "blank" | "approval")} className={workflowInputClass}><option value="blank">空テンプレート</option><option value="approval">アプリ承認テンプレート</option></select></WorkflowField>
          <Button variant="secondary" size="sm" onClick={() => void createNewWorkflow()} disabled={readOnly || isLoading} data-guide="workflow-create">新規ワークフロー</Button>
        </div>
        {isLoading ? <p className="text-xs text-on-surface-variant">読み込み中...</p> : !workflows.length ? <p className="text-xs text-on-surface-variant">ワークフローはまだありません。</p> : <div className="space-y-2">{workflows.map((workflow) => <button key={workflow.id} type="button" disabled={isSaving} onClick={() => { if (workflow.id !== activeWorkflowId && confirmDiscard()) { setActiveWorkflowId(workflow.id); setNotice(null); setError(null); } }} className={cn("w-full rounded-lg border p-3 text-left", activeWorkflowId === workflow.id ? "border-primary bg-primary-container/30" : "border-outline-variant bg-surface")}>
          <span className="block truncate text-sm font-semibold text-on-surface">{workflow.name}</span>
          <span className="mt-1 block text-xs text-on-surface-variant">{workflowTriggerLabels[workflow.triggerType]} / {workflow.status === "active" ? "有効" : "下書き"}</span>
        </button>)}</div>}
        {activeWorkflow && <><Button variant="danger" size="sm" className="mt-4" disabled={readOnly} onClick={() => void deleteCurrentWorkflow()}>ワークフローを削除</Button><WorkflowRunHistory key={activeWorkflow.id} appId={appId} workflowId={activeWorkflow.id} canManage={canManage} /></>}
      </aside>
      <section className="relative h-[65vh] min-w-0 flex-1 xl:sticky xl:top-14 xl:h-[calc(100vh-3.5rem)]" data-guide="workflow-canvas">
        {draft ? <WorkflowCanvas key={draft.id} definition={draft.definitionJson} selectedNodeId={selection.nodeId ?? ""} selectedEdgeId={selection.edgeId ?? ""} onSelect={setSelection} onChange={(definitionJson) => setDraft((current) => current ? { ...current, definitionJson } : null)} readOnly={readOnly} onError={setError} /> : <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">ワークフローを選択または作成してください。</div>}
        <div data-guide="workflow-ai-command"><AICommandBar /></div>
      </section>
      <aside className="w-full shrink-0 space-y-4 border-t border-outline-variant bg-surface p-4 xl:w-80 xl:border-l xl:border-t-0" data-guide="workflow-details">
        {error && <div role="alert" className="whitespace-pre-line rounded border border-error-container bg-error-container/40 p-3 text-xs text-on-error-container">{error}</div>}
        {notice && <div role="status" className="rounded bg-success-container/40 p-3 text-xs text-on-success-container">{notice}</div>}
        {!canManage && !isLoading && <p className="text-xs text-on-surface-variant">閲覧専用です。編集にはワークフロー管理権限が必要です。</p>}
        {draft && <>
          <fieldset disabled={readOnly} className="space-y-3 rounded-xl border border-outline-variant p-4" aria-label="ワークフロー設定">
            <WorkflowField label="ワークフロー名"><input className={workflowInputClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></WorkflowField>
            <WorkflowField label="トリガー種別"><select className={workflowInputClass} value={draft.triggerType} onChange={(event) => changeTriggerType(event.target.value as Workflow["triggerType"])}>{Object.entries(workflowTriggerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></WorkflowField>
            <WorkflowField label="保存する状態"><select className={workflowInputClass} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Workflow["status"] })}><option value="draft">下書き</option><option value="active">有効</option></select></WorkflowField>
          </fieldset>
          <section aria-label="有効化前の検証" className="rounded-xl border border-outline-variant p-3">
            <h2 className="text-xs font-bold text-on-surface">有効化前の検証</h2>
            {validationErrors.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-error">{validationErrors.map((message) => <li key={message}>{message}</li>)}</ul> : <p className="mt-2 text-xs text-on-success-container">定義と参照先の検証に問題はありません。</p>}
          </section>
          <WorkflowInspector definition={draft.definitionJson} context={context} selectedNodeId={selection.nodeId ?? ""} selectedEdgeId={selection.edgeId ?? ""} triggerType={draft.triggerType} onTriggerTypeChange={changeTriggerType} onChange={(definitionJson) => setDraft({ ...draft, definitionJson })} onSelect={setSelection} readOnly={readOnly} />
          <section className="space-y-2 rounded-xl border border-outline-variant p-3" aria-label="グラフ一覧">
            <h2 className="text-xs font-bold text-on-surface">ノードと接続</h2>
            {draft.definitionJson.nodes.map((node) => <button key={node.id} type="button" onClick={() => setSelection({ nodeId: node.id })} className={cn("block w-full rounded p-2 text-left text-xs", selection.nodeId === node.id ? "bg-primary-container" : "bg-surface-container-low")}>ノード: {node.data.label}</button>)}
            {draft.definitionJson.edges.map((edge) => <button key={edge.id} type="button" onClick={() => setSelection({ edgeId: edge.id })} className={cn("block w-full rounded p-2 text-left text-xs", selection.edgeId === edge.id ? "bg-primary-container" : "bg-surface-container-low")}>接続: {draft.definitionJson.nodes.find((node) => node.id === edge.source)?.data.label} → {draft.definitionJson.nodes.find((node) => node.id === edge.target)?.data.label} {edge.label ? `(${edge.label})` : ""}</button>)}
          </section>
          <fieldset disabled={readOnly} className="space-y-3 rounded-xl border border-outline-variant p-3" aria-label="接続を追加">
            <h2 className="text-xs font-bold text-on-surface">接続を追加</h2>
            <WorkflowField label="接続元"><select className={workflowInputClass} value={connectSource} onChange={(event) => { setConnectSource(event.target.value); setConnectBranch(workflowBranchOptions(draft.definitionJson.nodes.find((node) => node.id === event.target.value))[0].value); }}><option value="">選択してください</option>{draft.definitionJson.nodes.map((node) => <option key={node.id} value={node.id}>{node.data.label}</option>)}</select></WorkflowField>
            <WorkflowField label="接続先"><select className={workflowInputClass} value={connectTarget} onChange={(event) => setConnectTarget(event.target.value)}><option value="">選択してください</option>{draft.definitionJson.nodes.filter((node) => node.data.nodeType !== "trigger" && node.id !== connectSource).map((node) => <option key={node.id} value={node.id}>{node.data.label}</option>)}</select></WorkflowField>
            <WorkflowField label="接続する分岐"><select className={workflowInputClass} value={connectBranch} onChange={(event) => setConnectBranch(event.target.value)}>{workflowBranchOptions(draft.definitionJson.nodes.find((node) => node.id === connectSource)).map((branch) => <option key={branch.value} value={branch.value}>{branch.label}</option>)}</select></WorkflowField>
            <Button variant="secondary" size="sm" disabled={!connectSource || !connectTarget} onClick={() => { const result = connectEditorNodes(draft.definitionJson, connectSource, connectTarget, connectBranch); setError(result.error); if (!result.error) { setDraft({ ...draft, definitionJson: result.definition }); setSelection({ edgeId: result.definition.edges.at(-1)?.id }); } }}>接続を作成</Button>
          </fieldset>
        </>}
      </aside>
    </main>
  </>;
}

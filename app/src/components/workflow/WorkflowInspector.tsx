"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/shared/Button";
import { AIModelSelect } from "@/components/shared/AIModelSelect";
import { duplicateEditorNode, removeEditorNode, workflowBranchOptions, workflowNodeLabels, workflowTriggerLabels } from "@/lib/workflow-editor";
import type { Workflow, WorkflowDefinition, WorkflowEditorContext } from "@/types/workflow";

export const workflowInputClass = "w-full rounded-md border border-outline bg-surface px-3 py-2 text-xs text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function WorkflowField({ label, children }: { label: string; children: ReactNode }) {
  const inputId = useId();
  return <label htmlFor={inputId} className="block space-y-1.5"><span className="text-xs font-semibold text-on-surface-variant">{label}</span>{isValidElement(children) ? cloneElement(children as ReactElement<{ id: string; "aria-label": string }>, { id: inputId, "aria-label": label }) : children}</label>;
}

interface WorkflowInspectorProps {
  definition: WorkflowDefinition;
  context: WorkflowEditorContext | null;
  selectedNodeId: string;
  selectedEdgeId: string;
  triggerType: Workflow["triggerType"];
  onTriggerTypeChange: (triggerType: Workflow["triggerType"]) => void;
  onChange: (definition: WorkflowDefinition) => void;
  onSelect: (selection: { nodeId?: string; edgeId?: string }) => void;
  readOnly: boolean;
}

export function WorkflowInspector({ definition, context, selectedNodeId, selectedEdgeId, triggerType, onTriggerTypeChange, onChange, onSelect, readOnly }: WorkflowInspectorProps) {
  const node = definition.nodes.find((candidate) => candidate.id === selectedNodeId);
  const edge = definition.edges.find((candidate) => candidate.id === selectedEdgeId);
  if (!node && !edge) return <p className="text-xs text-on-surface-variant">ノードまたは接続を選択して設定します。</p>;

  function patchConfig(patch: Record<string, unknown>) {
    if (!node || readOnly) return;
    const config = { ...node.data.config, ...patch };
    for (const key of Object.keys(config)) if (config[key] === undefined) delete config[key];
    onChange({ ...definition, nodes: definition.nodes.map((candidate) => candidate.id === node.id ? { ...candidate, data: { ...candidate.data, config } } : candidate) });
  }

  function textConfig(label: string, key: string, multiline = false, placeholder?: string) {
    const value = node?.data.config?.[key];
    const props = { className: workflowInputClass, value: typeof value === "string" ? value : "", placeholder, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => patchConfig({ [key]: event.target.value || undefined }) };
    return <WorkflowField label={label}>{multiline ? <textarea {...props} rows={3} /> : <input {...props} />}</WorkflowField>;
  }

  function selectConfig(label: string, key: string, options: Array<{ value: string; label: string }>, fallback = "") {
    const value = String(node?.data.config?.[key] ?? fallback);
    return <WorkflowField label={label}><select className={workflowInputClass} value={value} onChange={(event) => patchConfig({ [key]: event.target.value || undefined })}>
      {!options.some((option) => option.value === value) && <option value={value}>{value}（要確認）</option>}
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></WorkflowField>;
  }

  function failurePolicy() {
    return selectConfig("失敗時の扱い", "failurePolicy", [{ value: "fail", label: "実行を停止" }, { value: "continue", label: "失敗を記録して続行" }], node?.data.config?.required === false ? "continue" : "fail");
  }

  const config = node?.data.config ?? {};
  const triggerConfig = definition.nodes.find((candidate) => candidate.data.nodeType === "trigger")?.data.config;
  const tables = context?.tables.filter((table) => (!triggerConfig?.tableId || triggerConfig.tableId === table.id) && (!triggerConfig?.tableCode || triggerConfig.tableCode === table.code)) ?? [];
  const fieldOptions = [...new Map(tables.flatMap((table) => table.fields).map((field) => [field.code, { value: field.code, label: `${field.name} (${field.code})` }])).values()];

  return <fieldset disabled={readOnly} className="space-y-3 rounded-xl border border-outline-variant bg-surface p-4" aria-label={node ? "ノード設定" : "接続設定"}>
    <h2 className="text-sm font-bold text-on-surface">{node ? `${workflowNodeLabels[node.data.nodeType]}設定` : "接続設定"}</h2>
    {edge && <>
      <p className="text-xs text-on-surface-variant">{definition.nodes.find((candidate) => candidate.id === edge.source)?.data.label} → {definition.nodes.find((candidate) => candidate.id === edge.target)?.data.label}</p>
      <WorkflowField label="分岐"><select className={workflowInputClass} value={String(edge.sourceHandle ?? edge.label ?? "")} onChange={(event) => onChange({ ...definition, edges: definition.edges.map((candidate) => candidate.id === edge.id ? { ...candidate, label: event.target.value || undefined, sourceHandle: event.target.value || undefined } : candidate) })}>
        {!workflowBranchOptions(definition.nodes.find((candidate) => candidate.id === edge.source)).some((branch) => branch.value === (edge.sourceHandle ?? edge.label ?? "")) && <option value={String(edge.sourceHandle ?? edge.label ?? "")}>{String(edge.sourceHandle ?? edge.label ?? "")}</option>}
        {workflowBranchOptions(definition.nodes.find((candidate) => candidate.id === edge.source)).map((branch) => <option key={branch.value} value={branch.value}>{branch.label}</option>)}
      </select></WorkflowField>
      <WorkflowField label="接続ラベル"><input className={workflowInputClass} value={edge.label ?? ""} onChange={(event) => onChange({ ...definition, edges: definition.edges.map((candidate) => candidate.id === edge.id ? { ...candidate, label: event.target.value || undefined, sourceHandle: undefined } : candidate) })} /></WorkflowField>
      <Button variant="danger" size="sm" onClick={() => { onChange({ ...definition, edges: definition.edges.filter((candidate) => candidate.id !== edge.id) }); onSelect({}); }}>接続を削除</Button>
    </>}
    {node && <>
      <WorkflowField label="ノード名"><input className={workflowInputClass} value={node.data.label} onChange={(event) => onChange({ ...definition, nodes: definition.nodes.map((candidate) => candidate.id === node.id ? { ...candidate, data: { ...candidate.data, label: event.target.value } } : candidate) })} /></WorkflowField>
      <WorkflowField label="説明"><textarea className={workflowInputClass} rows={2} value={node.data.description ?? ""} onChange={(event) => onChange({ ...definition, nodes: definition.nodes.map((candidate) => candidate.id === node.id ? { ...candidate, data: { ...candidate.data, description: event.target.value } } : candidate) })} /></WorkflowField>
      <div className="grid grid-cols-2 gap-2">{(["x", "y"] as const).map((axis) => <WorkflowField key={axis} label={`${axis.toUpperCase()}座標`}><input type="number" className={workflowInputClass} value={node.position?.[axis] ?? 0} onChange={(event) => onChange({ ...definition, nodes: definition.nodes.map((candidate) => candidate.id === node.id ? { ...candidate, position: { x: candidate.position?.x ?? 0, y: candidate.position?.y ?? 0, [axis]: Number(event.target.value) } } : candidate) })} /></WorkflowField>)}</div>

      {node.data.nodeType === "trigger" && <>
        <WorkflowField label="ノードのトリガー種別"><select className={workflowInputClass} value={triggerType} onChange={(event) => onTriggerTypeChange(event.target.value as Workflow["triggerType"])}>{Object.entries(workflowTriggerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></WorkflowField>
        <WorkflowField label="対象テーブル"><select className={workflowInputClass} value={String(config.tableId ?? "")} onChange={(event) => patchConfig({ tableId: event.target.value || undefined, tableCode: undefined })}><option value="">アプリ内の全テーブル</option>{context?.tables.map((table) => <option key={table.id} value={table.id}>{table.name} ({table.code})</option>)}</select></WorkflowField>
        {config.tableCode !== undefined && <p className="text-xs text-on-surface-variant">既存のテーブルコード指定: {String(config.tableCode)}</p>}
        {triggerType === "schedule" && <>
          <WorkflowField label="スケジュール間隔（分）"><input type="number" min={1} max={10080} step={1} className={workflowInputClass} value={Number(config.scheduleIntervalMinutes ?? 60)} onChange={(event) => patchConfig({ scheduleIntervalMinutes: Number(event.target.value) })} /></WorkflowField>
          <p className="text-xs text-on-surface-variant">保護されたcronで実行待ちへ登録し、別のdispatch workerが実行します。全対象の登録完了から指定時間後に次の周期を開始します。処理設定・接続・対象テーブルを変更すると新しい周期になります。</p>
        </>}
        {triggerType === "webhook" && <p className="text-xs text-warning">Webhook受信endpointは未実装です。現在は手動実行のみ利用できます。</p>}
      </>}
      {node.data.nodeType === "condition" && <>
        {selectConfig("比較フィールド", "fieldCode", [{ value: "status", label: "レコードステータス" }, ...fieldOptions.filter((field) => field.value !== "status")], "status")}
        {selectConfig("演算子", "operator", [{ value: "equals", label: "等しい" }, { value: "not_equals", label: "等しくない" }, { value: "contains", label: "含む" }, { value: "greater_than", label: "より大きい" }, { value: "less_than", label: "より小さい" }, { value: "empty", label: "空" }, { value: "not_empty", label: "空ではない" }], "equals")}
        {!["empty", "not_empty"].includes(String(config.operator)) && <WorkflowField label="比較値"><input className={workflowInputClass} value={String(config.value ?? config.expectedValue ?? config.status ?? "")} onChange={(event) => patchConfig({ value: event.target.value, expectedValue: undefined, status: undefined })} /></WorkflowField>}
        {textConfig("一致時の分岐ラベル", "yesLabel", false, "yes")}
        {textConfig("不一致時の分岐ラベル", "noLabel", false, "no")}
      </>}
      {node.data.nodeType === "approval" && <>
        {selectConfig("承認ポリシー", "policy", [{ value: "", label: "既存互換（アプリ設定を優先）" }, { value: "app", label: "アプリ承認設定を使用" }, { value: "override", label: "このノードで一時的に上書き" }])}
        {config.policy !== "override" && <p className="text-xs text-on-surface-variant">アプリ承認設定: {context?.approvalPolicy?.enabled ? "有効" : "未設定・無効"}。承認者・方式・ステータスはアプリ設定で管理します。</p>}
        {config.policy === "override" && <>
          {selectConfig("上書き承認者", "approverId", [{ value: "", label: "実行ユーザー" }, ...(context?.users.map((user) => ({ value: user.id, label: user.name })) ?? [])])}
          {textConfig("依頼タイトル", "titleTemplate", false, "{{recordTitle}} の承認")}
          {textConfig("依頼本文", "description", true)}
          {textConfig("承認待ちステータス", "pendingStatus", false, "pending_approval")}
          {textConfig("承認後ステータス", "approvedStatus", false, "approved")}
          {textConfig("却下後ステータス", "rejectedStatus", false, "rejected")}
          {textConfig("差戻し後ステータス", "returnedStatus", false, "returned")}
        </>}
      </>}
      {node.data.nodeType === "notification" && <>
        {selectConfig("通知先ロール", "roleType", [{ value: "", label: "実行ユーザー（ユーザー指定がない場合）" }, ...["tenant_admin", "app_admin", "approver", "user", "viewer"].map((role) => ({ value: role, label: role }))])}
        <WorkflowField label="通知先ユーザー（ロールより優先）"><select multiple className={workflowInputClass} value={Array.isArray(config.recipientIds) ? config.recipientIds as string[] : []} onChange={(event) => { const recipientIds = Array.from(event.target.selectedOptions, (option) => option.value); patchConfig({ recipientIds: recipientIds.length ? recipientIds : undefined }); }}>{context?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></WorkflowField>
        {textConfig("通知タイトル", "title", false, "{{recordTitle}} の通知")}
        {textConfig("通知本文", "body", true)}
        {textConfig("重複キー", "dedupeKey", false, "未指定: 実行・ノード単位")}
        {failurePolicy()}
      </>}
      {node.data.nodeType === "status_update" && <>{textConfig("更新先ステータス", "status")}{failurePolicy()}</>}
      {node.data.nodeType === "api_call" && <>
        {textConfig("送信先URL", "url", false, "https://example.com/api")}
        {selectConfig("HTTPメソッド", "method", ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].map((method) => ({ value: method, label: method })), "POST")}
        <WorkflowField label="ヘッダーJSON"><textarea className={workflowInputClass} rows={3} placeholder={'{"X-Record": "{{recordId}}"}'} value={typeof config.headers === "string" ? config.headers : config.headers ? JSON.stringify(config.headers, null, 2) : ""} onChange={(event) => patchConfig({ headers: event.target.value || undefined })} /></WorkflowField>
        {textConfig("本文JSONテンプレート", "bodyTemplate", true, '{"recordId": "{{recordId}}"}')}
        <WorkflowField label="タイムアウト（ミリ秒）"><input type="number" min={100} max={30000} step={100} className={workflowInputClass} value={Number(config.timeoutMs ?? 5000)} onChange={(event) => patchConfig({ timeoutMs: Number(event.target.value) })} /></WorkflowField>
        <p className="text-xs text-on-surface-variant">許可された送信先: {context?.allowedApiOrigins.join(", ") || "未設定（送信不可）"}。認証情報はヘッダーに保存できません。</p>
        {failurePolicy()}
      </>}
      {node.data.nodeType === "ai_action" && <>
        {selectConfig("AI処理", "action", [{ value: "summarize", label: "要約" }, { value: "next_actions", label: "次アクション" }, { value: "reply_draft", label: "返信案" }], "summarize")}
        <WorkflowField label="AIモデル"><AIModelSelect value={typeof config.model === "string" ? config.model : ""} onChange={(value) => patchConfig({ model: value || undefined })} allowDefault className={workflowInputClass} /></WorkflowField>
        {selectConfig("Prompt Template", "promptTemplateKey", [{ value: "", label: "アクションの既定テンプレート" }, ...(context?.promptTemplates.filter((template) => template.operation === `record.${config.action ?? "summarize"}`).map((template) => ({ value: template.key, label: template.name })) ?? [])])}
        {selectConfig("出力先", "output", [{ value: "comment", label: "システムコメント" }, { value: "field", label: "レコードのフィールド" }], "comment")}
        {config.output === "field" && selectConfig("出力先フィールド", "outputFieldCode", [{ value: "", label: "フィールドを選択" }, ...fieldOptions])}
        {failurePolicy()}
      </>}
      <p className="text-[11px] text-on-surface-muted">テンプレート変数: appCode / tableCode / tableName / recordId / recordTitle</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={node.data.nodeType === "trigger" || definition.nodes.length >= 100} onClick={() => { const duplicated = duplicateEditorNode(definition, node.id); onChange(duplicated); onSelect({ nodeId: duplicated.nodes.at(-1)?.id }); }}>ノードを複製</Button>
        <Button variant="danger" size="sm" onClick={() => { onChange(removeEditorNode(definition, node.id)); onSelect({}); }}>ノードを削除</Button>
      </div>
    </>}
  </fieldset>;
}

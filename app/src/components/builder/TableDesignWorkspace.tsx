"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CreationDialog } from "@/components/builder/CreationDialog";
import { FormLayoutBuilder } from "@/components/builder/FormLayoutBuilder";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { TopBar } from "@/components/shared/TopBar";
import { useShellChrome } from "@/components/shared/ShellChrome";
import { automaticCode, FIELD_TYPES, splitChoices } from "@/lib/app-creation";
import { locateField, placeField, setFieldColumns, type DropTarget } from "@/lib/blueprint-layout";
import { apiFetch } from "@/lib/api/client";
import { formRowsFromFields, type FormLayoutField } from "@/lib/form-layout";
import { designFieldCode, newDesignField, patchDesignField, serializeTableDesign, tableDesignDraft, tableDesignErrors, type DesignField, type TableDesignDraft, type TableDesignSnapshot } from "@/lib/table-design";
import type { AppField, FieldType } from "@/types/app";
import "./app-creation.css";
import "./table-design.css";

const EXTENDED_TYPES: Record<string, string> = { user_ref: "ユーザー参照", master_ref: "他テーブル参照", file: "ファイル", ai_generated: "AI生成", calculated: "計算式" };

function Choices({ field, onChange }: { field: DesignField; onChange: (options: string[]) => void }) {
  const [input, setInput] = useState("");
  const composing = useRef(false);
  function commit(value: string) { onChange(splitChoices(value, field.options).choices); setInput(""); }
  return <div className="td-control"><label htmlFor="design-options">選択肢</label><div className="td-choices">{field.options.map((option) => <span key={option}>{option}<button type="button" aria-label={`選択肢「${option}」を削除`} onClick={() => onChange(field.options.filter((candidate) => candidate !== option))}>×</button></span>)}<input id="design-options" value={input} placeholder="入力してEnterで追加" onCompositionStart={() => { composing.current = true; }} onCompositionEnd={(event) => { composing.current = false; if (/[,、，]/.test(event.currentTarget.value)) commit(event.currentTarget.value); }} onChange={(event) => { if (!composing.current && /[,、，]/.test(event.target.value)) commit(event.target.value); else setInput(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter" && !composing.current && !event.nativeEvent.isComposing) { event.preventDefault(); commit(input); } }} onBlur={() => { if (!composing.current && input.trim()) commit(input); }} onPaste={(event) => { event.preventDefault(); commit(event.clipboardData.getData("text")); }} /></div><p>Enter・カンマ・読点で確定。複数行の貼り付けもできます。</p></div>;
}

export function TableDesignWorkspace({ appId, onAdvanced }: { appId: string; onAdvanced: () => void }) {
  const { isSidebarCollapsed } = useShellChrome();
  const [snapshot, setSnapshot] = useState<TableDesignSnapshot | null>(null);
  const [draft, setDraft] = useState<TableDesignDraft | null>(null);
  const [baseline, setBaseline] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [compact, setCompact] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [view, setView] = useState<"form" | "table">("form");
  const nameInput = useRef<HTMLInputElement>(null);
  const dirty = !!draft && JSON.stringify(draft) !== baseline;
  const endpoint = `/api/apps/${appId}/designer`;

  const accept = useCallback((next: TableDesignSnapshot, tableId?: string, formId?: string) => {
    const nextDraft = tableDesignDraft(next, tableId, formId);
    setSnapshot(next); setDraft(nextDraft); setBaseline(JSON.stringify(nextDraft));
    setSelectedId(nextDraft.rows[0]?.items[0] ?? nextDraft.fields[0]?.id ?? "");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void apiFetch<TableDesignSnapshot>(endpoint, { signal: controller.signal }).then((next) => { if (!controller.signal.aborted) accept(next); }).catch((nextError) => { if (!controller.signal.aborted) setError(nextError instanceof Error ? nextError.message : "設計を取得できませんでした。"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, accept]);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1279px)");
    const update = () => setCompact(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useLayoutEffect(() => { if (focusRequest) { nameInput.current?.focus(); nameInput.current?.select(); } }, [focusRequest]);

  function canLeave() { return !dirty || window.confirm("未保存の設計を破棄して移動しますか？"); }
  function select(id: string, openSettings = true, focus = false) { setSelectedId(id); if (compact && openSettings) setDrawer(true); if (focus) setFocusRequest((current) => current + 1); }
  function change(next: TableDesignDraft) { setDraft(next); setMessage(""); }
  function add(type: FieldType, target: DropTarget) {
    if (!draft || saving) return;
    const field = newDesignField(draft, type);
    change({ ...draft, fields: [...draft.fields, field], rows: placeField(draft.rows, field.id, target) });
    select(field.id, true, true); setView("form");
  }
  function patch(patch: Partial<DesignField>) { if (draft && selectedId) change(patchDesignField(draft, selectedId, patch)); }
  function remove(id: string) {
    if (!draft || saving) return;
    const field = draft.fields.find((candidate) => candidate.id === id);
    if (!field) return;
    if (field.persistedId && field.required) { setMessage("テーブルの必須項目は非表示にできません。必須を解除してから非表示にしてください。"); return; }
    const fields = field.persistedId ? draft.fields.map((candidate) => candidate.id === id ? { ...candidate, visible: false, formRequired: false } : candidate) : draft.fields.filter((candidate) => candidate.id !== id);
    change({ ...draft, fields, rows: draft.rows.map((row) => ({ ...row, items: row.items.filter((item) => item !== id) })).filter((row) => row.items.length) });
    if (!field.persistedId) { setSelectedId(fields[0]?.id ?? ""); setDrawer(false); }
    setMessage(field.persistedId ? "フォームから非表示にしました。保存済みの項目とレコードは削除しません。" : "未保存の項目を削除しました。");
  }
  function duplicate(id: string) {
    if (!draft || saving) return;
    const original = draft.fields.find((field) => field.id === id);
    if (!original || !FIELD_TYPES.some((type) => type.type === original.fieldType)) return;
    const field = { ...newDesignField(draft, original.fieldType), name: `${original.name}（コピー）`, code: designFieldCode(original.code, draft.fields), options: [...original.options], helpText: original.helpText };
    const location = locateField(draft.rows, id);
    change({ ...draft, fields: [...draft.fields, field], rows: placeField(draft.rows, field.id, { row: location?.row ?? draft.rows.length, position: location ? "after" : "end" }) });
    select(field.id, true, true);
  }
  async function reload() {
    if (saving || !canLeave()) return;
    setLoading(true); setError(""); setDrawer(false);
    try { accept(await apiFetch<TableDesignSnapshot>(endpoint)); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "再読み込みできませんでした。"); }
    finally { setLoading(false); }
  }
  async function save() {
    if (!draft || !snapshot || saving || tableDesignErrors(draft).length) return;
    setSaving(true); setError(""); setMessage(""); setDrawer(false);
    try {
      const next = await apiFetch<TableDesignSnapshot>(endpoint, { method: "PUT", body: JSON.stringify(serializeTableDesign(draft, snapshot.revision)) });
      const form = next.forms.find((candidate) => candidate.name === draft.formName.trim() && (!draft.tableId || candidate.tableId === draft.tableId));
      accept(next, form?.tableId, form?.id); setMessage("テーブル・項目・フォームの設計を保存しました。");
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "保存できませんでした。設計は保持されています。"); }
    finally { setSaving(false); }
  }

  const selected = draft?.fields.find((field) => field.id === selectedId) ?? draft?.fields[0];
  const location = draft && selected ? locateField(draft.rows, selected.id) : null;
  const row = location && draft ? draft.rows[location.row] : null;
  const errors = draft ? tableDesignErrors(draft) : [];
  const settings = <section className="td-panel" aria-label="項目の設定"><h2>項目の設定</h2>{selected && draft ? <fieldset disabled={saving}>
    <label className="td-control">表示名<input ref={nameInput} value={selected.name} onChange={(event) => patch({ name: event.target.value })} maxLength={100} /></label>
    <label className="td-control">フィールドコード{!selected.persistedId && <small> — {selected.codeAuto ? "自動" : "手動"}</small>}<input value={selected.code} disabled={!!selected.persistedId} onChange={(event) => patch({ code: event.target.value })} maxLength={64} className="td-code" /></label>
    <label className="td-control">型<select value={selected.fieldType} disabled={!!selected.persistedId} onChange={(event) => patch({ fieldType: event.target.value as FieldType, options: event.target.value === "select" ? ["選択肢A", "選択肢B"] : [] })}>{FIELD_TYPES.map((type) => <option key={type.type} value={type.type}>{type.label}</option>)}{EXTENDED_TYPES[selected.fieldType] && <option value={selected.fieldType}>{EXTENDED_TYPES[selected.fieldType]}</option>}</select></label>
    {selected.persistedId && <p className="td-note">コード・型は保存データの保護のため固定です。参照先・一意制約などは「詳細設定」で編集できます。</p>}
    <label className="td-check"><input type="checkbox" checked={selected.required} onChange={(event) => patch({ required: event.target.checked })} />必須（テーブル）</label>
    <label className="td-check"><input type="checkbox" checked={selected.formRequired || selected.required} disabled={selected.required || !row} onChange={(event) => patch({ formRequired: event.target.checked })} />このフォームで必須</label>
    {selected.fieldType === "select" && <Choices key={selected.id} field={selected} onChange={(options) => patch({ options })} />}
    <div className="td-control"><span>配置</span><div className="fl-width" role="group" aria-label="項目の配置"><button type="button" disabled={!row} aria-pressed={row?.cols === 1} onClick={() => change({ ...draft, rows: setFieldColumns(draft.rows, selected.id, 1) })}>全幅</button><button type="button" disabled={!row} aria-pressed={row?.cols === 2} onClick={() => change({ ...draft, rows: setFieldColumns(draft.rows, selected.id, 2) })}>2列（半分）</button></div></div>
    <label className="td-control">入力時の補足<textarea value={selected.helpText} onChange={(event) => patch({ helpText: event.target.value })} rows={2} maxLength={1000} /></label>
    {!row && <p className="td-note">この項目は非表示です。左の項目から再配置できます。</p>}
    <div className="td-item-actions"><Button variant="secondary" size="sm" disabled={!FIELD_TYPES.some((type) => type.type === selected.fieldType)} onClick={() => duplicate(selected.id)}>複製</Button><Button variant="danger" size="sm" disabled={!!selected.persistedId && selected.required} onClick={() => remove(selected.id)}><Icon name={selected.persistedId ? "visibility_off" : "delete"} size="sm" />{selected.persistedId ? "非表示" : "削除"}</Button></div>
    <p className="td-note">{selected.persistedId ? "非表示にしても項目と保存済みレコードは残ります。" : "未保存の項目は削除できます。保存後は非表示になります。"}</p>
  </fieldset> : <p className="td-note">部品を追加するか、中央の項目を選択してください。</p>}</section>;
  const summary = draft && snapshot && <section className="td-panel td-summary" aria-label="保存されるもの"><h2>保存されるもの</h2><p><Icon name="database" size="sm" />{draft.fields.length}項目 · フォーム{draft.rows.length}行（2列の行{draft.rows.filter((candidate) => candidate.cols === 2).length}）</p><p><Icon name="view_list" size="sm" />{snapshot.views.some((candidate) => candidate.tableId === draft.tableId) ? "既存のビューを維持" : "一覧ビューを自動作成"}</p><p><Icon name="shield" size="sm" />既存レコード・参照設定は維持</p><p><Icon name="edit_document" size="sm" />{snapshot.app.status === "draft" ? "下書きのまま保存（公開しません）" : "保存後は現在のアプリに反映されます"}</p><p className="td-note">サンプルデータは追加しません。項目・配置は保存するまでDBに反映されません。</p></section>;

  return <>
    <TopBar title="テーブルの設計" breadcrumbs={[{ label: "ビルダー", href: "/apps" }, { label: snapshot?.app.name ?? "アプリ" }, { label: "テーブル" }]} actions={<Button variant="secondary" onClick={() => { if (!saving && canLeave()) onAdvanced(); }}>ビュー・詳細設定</Button>} />
    <main className="td-page">
      <div className="td-title"><div><h1>テーブルを設計</h1><p>左の部品をドラッグして項目を追加。カードを並べ替え、右で項目を設定します。</p></div><Button variant="secondary" onClick={() => { if (!saving && canLeave()) onAdvanced(); }} disabled={saving}>詳細設定</Button></div>
      {error && <div role="alert" className="td-error">{error}<Button variant="secondary" size="sm" onClick={() => void reload()} disabled={saving}>再読み込み</Button></div>}
      {loading ? <p className="td-note" role="status">設計を読み込み中...</p> : draft && snapshot && <>
        <fieldset disabled={saving} className="td-metadata" data-guide="builder-design-metadata">
          <label className="td-control">アプリ名<input value={draft.appName} onChange={(event) => change({ ...draft, appName: event.target.value })} maxLength={100} /></label>
          <label className="td-control">アプリコード<input value={snapshot.app.code} readOnly className="td-code" /></label>
          <label className="td-control">テーブル名<input value={draft.tableName} onChange={(event) => change({ ...draft, tableName: event.target.value, tableCode: draft.tableCodeAuto ? automaticCode(event.target.value, draft.tableCode, "-") : draft.tableCode })} maxLength={100} /></label>
          <label className="td-control">テーブルコード{!draft.tableId && <small> — {draft.tableCodeAuto ? "自動" : "手動"}</small>}<input value={draft.tableCode} disabled={!!draft.tableId} onChange={(event) => change({ ...draft, tableCode: event.target.value, tableCodeAuto: false })} maxLength={64} className="td-code" /></label>
          <p className="td-note">1アプリにつき1テーブル。既存のコードは変更しません。{snapshot.app.description}</p>
        </fieldset>
        <div className="td-form-toolbar"><label className="td-control">フォーム名<input value={draft.formName} disabled={saving} onChange={(event) => change({ ...draft, formName: event.target.value })} maxLength={100} /></label>{snapshot.forms.length > 0 && <label className="td-control">編集するフォーム<select value={draft.formId ?? "new"} disabled={saving} onChange={(event) => { if (canLeave()) { const next = tableDesignDraft(snapshot, draft.tableId, event.target.value); change(next); setBaseline(JSON.stringify(next)); setSelectedId(next.rows[0]?.items[0] ?? ""); } }}>{snapshot.forms.filter((form) => form.tableId === draft.tableId).map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}<option value="new">新しいフォーム</option></select></label>}<div className="td-view-switch" role="group" aria-label="設計の表示"><button type="button" aria-pressed={view === "form"} onClick={() => setView("form")}>フォーム</button><button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>表</button></div>{compact && <Button variant="secondary" onClick={() => setDrawer(true)}>項目の設定</Button>}</div>
        {view === "form" ? <FormLayoutBuilder fields={draft.fields.map((field): AppField => ({ id: field.persistedId ?? `new:${field.id}`, tenantId: snapshot.app.tenantId, appId, tableId: draft.tableId ?? "new", name: field.name, code: field.id, fieldType: field.fieldType, required: field.required, uniqueFlag: false, settingsJson: { options: field.options }, sortOrder: 0, createdAt: snapshot.app.createdAt }))} value={draft.fields.map((field): FormLayoutField => { const position = locateField(draft.rows, field.id); return { fieldCode: field.id, visible: !!position, required: field.formRequired || field.required, width: position && draft.rows[position.row].cols === 2 ? "half" : "full", ...(position ? { rowIndex: position.row } : {}), helpText: field.helpText }; })} selectedField={selected?.id} onSelect={select} onDuplicate={duplicate} onRemove={remove} onChange={(value) => change({ ...draft, rows: formRowsFromFields(value), fields: draft.fields.map((field) => { const configuration = value.find((candidate) => candidate.fieldCode === field.id)!; return { ...field, visible: configuration.visible, formRequired: configuration.required, helpText: configuration.helpText }; }) })} disabled={saving} palette={{ items: FIELD_TYPES, onAdd: add }} settings={compact ? <></> : <>{settings}{summary}</>} /> : <div className="td-table-preview"><table><caption>項目の設計一覧（レコードではありません）</caption><thead><tr><th>表示名</th><th>コード</th><th>型</th><th>設定</th></tr></thead><tbody>{draft.fields.map((field) => <tr key={field.id}><td><button type="button" onClick={() => { setView("form"); select(field.id); }}>{field.name}</button></td><td><code>{field.code}</code></td><td>{FIELD_TYPES.find((type) => type.type === field.fieldType)?.label ?? EXTENDED_TYPES[field.fieldType]}</td><td>{field.required ? "必須" : "任意"} · {locateField(draft.rows, field.id) ? "表示" : "非表示"}</td></tr>)}</tbody></table></div>}
        {compact && summary}
        <footer className={`td-footer${isSidebarCollapsed ? " is-collapsed" : ""}`}><div>{errors.length > 0 ? <p className="td-note">{errors[0]}</p> : <p className="td-note">{dirty ? "未保存の変更があります" : "保存済みの設計を表示しています"}</p>}<p role="status" className="td-message">{message}</p></div><div className="td-footer-actions"><Link href={draft.tableId ? `/run/${snapshot.app.code}/${draft.tableCode}` : "/apps"} onClick={(event) => { if (saving || !canLeave()) event.preventDefault(); }} className="td-preview-link">{draft.tableId ? "プレビュー" : "キャンセル"}</Link><Button variant="secondary" disabled={saving || !dirty} onClick={() => { if (canLeave()) { const original = JSON.parse(baseline) as TableDesignDraft; change(original); setSelectedId(original.rows[0]?.items[0] ?? ""); setDrawer(false); setError(""); } }}>変更を戻す</Button><Button disabled={saving || errors.length > 0 || (!dirty && !!draft.formId)} onClick={() => void save()}><Icon name="save" size="sm" />{saving ? "保存中..." : draft.tableId ? "設計を保存" : "テーブルを作成"}</Button></div></footer>
        {compact && drawer && <CreationDialog title="項目の設定" drawer onClose={() => setDrawer(false)}>{settings}</CreationDialog>}
      </>}
    </main>
  </>;
}

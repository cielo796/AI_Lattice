"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Icon } from "@/components/shared/Icon";
import { CreationDialog } from "@/components/builder/CreationDialog";
import { automaticCode, blueprintFromDraft, FIELD_TYPES, fieldCodeError, newDraftField, orderedFields, splitChoices, uniqueFieldCode, type AppDraft, type DraftField } from "@/lib/app-creation";
import { hitTestDrop, locateField, moveFieldByKeyboard, placeField, setFieldColumns, type DropTarget, type FormRow } from "@/lib/blueprint-layout";
import { buildInitialViewsForTable } from "@/lib/blueprint-views";
import type { GeneratedBlueprintFieldType, GeneratedBlueprintSuggestion } from "@/types/ai";

type AddSpec = { type: GeneratedBlueprintFieldType; suggestion?: GeneratedBlueprintSuggestion };
type DragPayload = { id?: string; spec?: AddSpec; label: string; type: GeneratedBlueprintFieldType };
type DragState = DragPayload & { x: number; y: number; target: DropTarget | null; indicator?: CSSProperties };

function typeDefinition(type: GeneratedBlueprintFieldType) { return FIELD_TYPES.find((candidate) => candidate.type === type)!; }

function FieldMock({ field }: { field: DraftField }) {
  const definition = typeDefinition(field.fieldType);
  return <div className={`ac-field-mock${field.fieldType === "textarea" ? " ac-field-long" : ""}`} aria-hidden="true">
    {field.fieldType === "boolean" ? <><span className="ac-toggle" />オフ</> : field.fieldType === "select" ? <>{field.options[0] ?? "選択してください"}<Icon name="expand_more" size="sm" /></> : <>
      {(field.fieldType === "date" || field.fieldType === "datetime") && <Icon name={definition.icon} size="sm" />}
      {field.fieldType === "number" ? "0" : field.fieldType === "date" ? "年 / 月 / 日" : field.fieldType === "datetime" ? "年 / 月 / 日  時:分" : field.fieldType === "textarea" ? "複数行のテキスト" : `${field.name}を入力`}
    </>}
  </div>;
}

function ChoiceEditor({ field, onChange, notify }: { field: DraftField; onChange: (options: string[]) => void; notify: (message: string) => void }) {
  const [input, setInput] = useState("");
  const commit = (value: string) => {
    const result = splitChoices(value, field.options);
    onChange(result.choices); setInput("");
    if (result.duplicates.length) notify(`「${result.duplicates[0]}」はすでにあります`);
  };
  return <div className="ac-control"><label htmlFor={`choices-${field.id}`}>選択肢</label><div className="ac-choice-tags">
    {field.options.map((option) => <span className="ac-choice-tag" key={option}>{option}<button type="button" aria-label={`選択肢「${option}」を削除`} onClick={() => onChange(field.options.filter((item) => item !== option))}>×</button></span>)}
    <input id={`choices-${field.id}`} value={input} placeholder="入力してEnterで追加" onChange={(event) => { const value = event.target.value; if (/[,、，]/.test(value)) commit(value); else setInput(value); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(input); } }} onBlur={() => { if (input.trim()) commit(input); }} onPaste={(event) => { event.preventDefault(); commit(event.clipboardData.getData("text")); }} />
  </div><p className="ac-caption">Enter・カンマ・読点で確定。複数行の貼り付けもできます。</p></div>;
}

export function FieldBuilder({ draft, onChange, highlights = {} }: { draft: AppDraft; onChange: (draft: AppDraft) => void; highlights?: Record<string, "追加" | "変更"> }) {
  const fields = orderedFields(draft);
  const [selectedId, setSelectedId] = useState(fields[0]?.id ?? "");
  const selected = draft.fields[selectedId] ?? fields[0];
  const [view, setView] = useState<"form" | "table">("form");
  const [announcement, setAnnouncement] = useState("");
  const [toast, setToast] = useState("");
  const [freshId, setFreshId] = useState("");
  const [focusRequest, setFocusRequest] = useState(0);
  const [compact, setCompact] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const dragCleanup = useRef<(() => void) | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const freshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const full = fields.length >= 10;

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1279px)");
    const update = () => setCompact(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!focusRequest) return;
    const frame = requestAnimationFrame(() => { nameInput.current?.focus(); nameInput.current?.select(); });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);
  useEffect(() => () => { dragCleanup.current?.(); if (toastTimer.current) clearTimeout(toastTimer.current); if (freshTimer.current) clearTimeout(freshTimer.current); }, []);

  function notify(message: string) {
    setToast(message); setAnnouncement(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }
  function select(id: string, focusName = false) {
    setSelectedId(id); setDrawerOpen(true);
    if (focusName) setFocusRequest((current) => current + 1);
  }
  function announcePosition(next: AppDraft, id: string, action: string) {
    const location = locateField(next.layout, id);
    if (location) setAnnouncement(`${next.fields[id].name}を${location.row + 1}行目に${action}しました${next.layout[location.row].cols === 2 ? "（2列）" : ""}`);
  }
  function add(spec: AddSpec, target: DropTarget = { row: draft.layout.length, position: "end" }) {
    if (full) { notify("フィールドは10個までです"); return; }
    const field = newDraftField(draft, spec.type, spec.suggestion);
    const next = { ...draft, fields: { ...draft.fields, [field.id]: field }, layout: placeField(draft.layout, field.id, target), suggestions: spec.suggestion ? draft.suggestions.filter((candidate) => candidate.code !== spec.suggestion?.code) : draft.suggestions };
    onChange(next); select(field.id, true); setFreshId(field.id); announcePosition(next, field.id, "追加");
    if (freshTimer.current) clearTimeout(freshTimer.current);
    freshTimer.current = setTimeout(() => setFreshId(""), 500);
  }
  function updateField(id: string, patch: Partial<DraftField>) {
    const original = draft.fields[id];
    const next = { ...original, ...patch, edited: true };
    if (patch.code !== undefined) next.codeAuto = false;
    else if (patch.name !== undefined && original.codeAuto) next.code = uniqueFieldCode(automaticCode(patch.name, original.code), fields, id);
    if (patch.fieldType === "select" && !next.options.length) next.options = ["選択肢A", "選択肢B"];
    onChange({ ...draft, fields: { ...draft.fields, [id]: next } });
  }
  function remove(id: string) {
    if (fields.length <= 1) { notify("最後の1項目は削除できません"); return; }
    const remaining = { ...draft.fields }; delete remaining[id];
    const next = { ...draft, fields: remaining, layout: draft.layout.map((row) => ({ ...row, items: row.items.filter((item) => item !== id) })).filter((row) => row.items.length > 0) };
    onChange(next); setSelectedId(orderedFields(next)[0].id); setAnnouncement(`${draft.fields[id].name}を削除しました`);
  }
  function duplicate(id: string) {
    if (full) { notify("フィールドは10個までです"); return; }
    const field = draft.fields[id];
    const copy = { ...field, id: crypto.randomUUID(), name: `${field.name}（コピー）`, code: uniqueFieldCode(field.code, fields), codeAuto: true, source: "user" as const, reason: undefined, edited: true, options: [...field.options] };
    const location = locateField(draft.layout, id)!;
    const next = { ...draft, fields: { ...draft.fields, [copy.id]: copy }, layout: placeField(draft.layout, copy.id, { row: location.row, position: draft.layout[location.row].cols === 2 && draft.layout[location.row].items.length === 1 ? "slot" : "after" }) };
    onChange(next); select(copy.id, true); announcePosition(next, copy.id, "追加");
  }
  function changeLayout(layout: FormRow[], id: string) {
    const next = { ...draft, layout }; onChange(next); select(id); announcePosition(next, id, "移動");
  }
  function keyboard(event: KeyboardEvent<HTMLElement>, id: string) {
    if (event.target !== event.currentTarget) return;
    if (event.altKey && event.key.startsWith("Arrow")) {
      event.preventDefault(); changeLayout(moveFieldByKeyboard(draft.layout, id, event.key), id);
      requestAnimationFrame(() => canvas.current?.querySelector<HTMLElement>(`[data-field-id="${id}"]`)?.focus());
    } else if (event.key === "Enter") { event.preventDefault(); select(id, true); }
    else if (event.key === "Delete") { event.preventDefault(); remove(id); }
  }
  function beginPointer(event: PointerEvent<HTMLElement>, payload: DragPayload) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button,input,select")) return;
    if (!payload.id && full) { notify("フィールドは10個までです"); return; }
    event.preventDefault(); dragCleanup.current?.(); event.currentTarget.focus();
    const source = event.currentTarget;
    const startX = event.clientX, startY = event.clientY, pointerId = event.pointerId;
    source.setPointerCapture(pointerId);
    let started = false;
    let target: DropTarget | null = null;
    function cleanup() {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); window.removeEventListener("keydown", escape);
      if (source.hasPointerCapture(pointerId)) source.releasePointerCapture(pointerId);
      setDrag(null); dragCleanup.current = null;
    }
    function cancel() { cleanup(); setAnnouncement("ドラッグを取り消しました"); }
    function escape(key: globalThis.KeyboardEvent) { if (key.key === "Escape") { key.preventDefault(); cancel(); } }
    function measure(clientX: number, clientY: number) {
      const element = canvas.current;
      if (!element) return { target: null, indicator: undefined };
      const bounds = element.getBoundingClientRect();
      const tableMode = view === "table";
      const rowElements = Array.from(element.querySelectorAll<HTMLElement>(tableMode ? "[data-table-field]" : "[data-form-row]"));
      const geometry = rowElements.map((row) => ({ rect: row.getBoundingClientRect(), cells: tableMode ? [{ rect: row.getBoundingClientRect(), id: row.dataset.fieldId }] : Array.from(row.querySelectorAll<HTMLElement>("[data-field-id],[data-empty-slot]")).map((cell) => ({ rect: cell.getBoundingClientRect(), id: cell.dataset.fieldId })) }));
      const layout = tableMode ? fields.map((field): FormRow => ({ cols: 1, items: [field.id] })) : draft.layout;
      const hit = hitTestDrop(layout, geometry, bounds, clientX, clientY, payload.id);
      let indicator: CSSProperties | undefined;
      if (hit && !["self", "slot"].includes(hit.position)) {
        const side = hit.position === "left" || hit.position === "right";
        const rect = hit.position === "end" ? element.querySelector<HTMLElement>("[data-endzone]")!.getBoundingClientRect() : side ? geometry[hit.row].cells.find((cell) => cell.id !== payload.id)!.rect : geometry[hit.row].rect;
        indicator = side ? { top: rect.top - bounds.top, height: rect.bottom - rect.top, left: (hit.position === "left" ? rect.left : rect.right) - bounds.left } : { top: (hit.position === "before" || hit.position === "end" ? rect.top - 5 : rect.bottom + 3) - bounds.top, left: 12, right: 12 };
      }
      const mapped = hit && tableMode && hit.position !== "end" ? { ...hit, row: locateField(draft.layout, fields[hit.row].id)!.row } : hit;
      return { target: mapped, indicator };
    }
    function move(pointer: globalThis.PointerEvent) {
      if (pointer.pointerId !== pointerId) return;
      if (!started && Math.abs(pointer.clientX - startX) + Math.abs(pointer.clientY - startY) < 5) return;
      started = true;
      if (pointer.clientY > window.innerHeight - 48) window.scrollBy(0, 14); else if (pointer.clientY < 64) window.scrollBy(0, -14);
      const measured = measure(pointer.clientX, pointer.clientY); target = measured.target;
      setDrag({ ...payload, x: pointer.clientX, y: pointer.clientY, ...measured });
    }
    function finish(pointer: globalThis.PointerEvent) {
      if (pointer.pointerId !== pointerId) return;
      if (started) target = measure(pointer.clientX, pointer.clientY).target;
      cleanup();
      if (!started) { if (payload.id) select(payload.id); else if (payload.spec) add(payload.spec); return; }
      if (!target) { setAnnouncement("ドラッグを取り消しました"); return; }
      if (payload.id) changeLayout(placeField(draft.layout, payload.id, target), payload.id); else if (payload.spec) add(payload.spec, target);
    }
    dragCleanup.current = cleanup;
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", cancel); window.addEventListener("keydown", escape);
  }

  const location = selected ? locateField(draft.layout, selected.id) : null;
  const row = location ? draft.layout[location.row] : null;
  const partner = row?.items.find((id) => id !== selected?.id);
  const views = buildInitialViewsForTable(blueprintFromDraft(draft).tables[0]);
  const properties = <>
    {selected && <section className="ac-panel ac-settings" aria-label="項目の設定">
      <div className="ac-panel-heading"><h3>項目の設定</h3><span className="ac-badge">{typeDefinition(selected.fieldType).label}</span></div>
      <div className="ac-control"><label htmlFor="creation-field-name">表示名</label><input ref={nameInput} id="creation-field-name" value={selected.name} onChange={(event) => updateField(selected.id, { name: event.target.value })} /></div>
      <div className="ac-control"><label htmlFor="creation-field-code">フィールドコード <span className="ac-caption">— {selected.codeAuto ? "自動" : "手動"}</span></label><input id="creation-field-code" className="ac-code" value={selected.code} aria-invalid={Boolean(fieldCodeError(selected, fields))} aria-describedby="creation-field-code-error" onChange={(event) => updateField(selected.id, { code: event.target.value })} /><p id="creation-field-code-error" className="ac-error">{fieldCodeError(selected, fields)}</p></div>
      <div className="ac-type-required"><div className="ac-control"><label htmlFor="creation-field-type">型</label><select id="creation-field-type" value={selected.fieldType} onChange={(event) => updateField(selected.id, { fieldType: event.target.value as GeneratedBlueprintFieldType })}>{FIELD_TYPES.map((type) => <option key={type.type} value={type.type}>{type.label}</option>)}</select></div><button className="ac-toggle-control" type="button" role="switch" aria-checked={selected.required} aria-label="必須" onClick={() => updateField(selected.id, { required: !selected.required })}><span className={`ac-toggle${selected.required ? " is-on" : ""}`} />必須</button></div>
      <div className="ac-control"><span className="ac-label">配置</span><div className="ac-segment" role="group" aria-label="配置"><button type="button" aria-pressed={row?.cols === 1} onClick={() => changeLayout(setFieldColumns(draft.layout, selected.id, 1), selected.id)}>全幅</button><button type="button" aria-pressed={row?.cols === 2} onClick={() => changeLayout(setFieldColumns(draft.layout, selected.id, 2), selected.id)}>2列（半分）</button></div>
        {row?.cols === 2 && <p className="ac-caption">{partner ? `「${draft.fields[partner].name}」と横に並んでいます` : "右側が空いています。ドラッグで項目を置けます"}</p>}
        {row?.cols === 2 && selected.fieldType === "textarea" && <p className="ac-warning">長文は全幅をおすすめします</p>}
      </div>
      {selected.fieldType === "select" && <ChoiceEditor key={selected.id} field={selected} onChange={(options) => updateField(selected.id, { options })} notify={notify} />}
      {selected.reason && <p className="ac-ai-reason"><strong>✧ AI提案</strong> {selected.reason}</p>}
      <div className="ac-panel-actions"><button type="button" className="ac-button" aria-disabled={full} onClick={() => duplicate(selected.id)}>複製</button><button type="button" className="ac-button ac-danger-button" disabled={fields.length === 1} onClick={() => remove(selected.id)}>削除</button></div>
      {fields.length === 1 && <p className="ac-caption">最後の1項目は削除できません。</p>}
    </section>}
    <section className="ac-panel ac-outcome" aria-label="作成されるもの"><h3>作成されるもの</h3><div className="ac-outcome-item"><Icon name="draft" /><div><strong>下書きとして保存</strong><p className="ac-caption">公開するまで利用者には見えません</p></div></div><div className="ac-outcome-item"><Icon name="database" /><div>フィールド {fields.length}個・サンプル3件<p className="ac-caption">フォームは{draft.layout.length}行（2列の行{draft.layout.filter((candidate) => candidate.cols === 2).length}）</p></div></div><ul>{views.map((item) => <li key={item.viewType}><strong>{item.name}</strong><span className="ac-caption"> — {item.reason}</span></li>)}</ul></section>
  </>;

  function palette(spec: AddSpec, label: string, description: string) {
    const definition = typeDefinition(spec.type);
    return <div key={spec.suggestion?.code ?? spec.type} role="button" tabIndex={0} aria-label={`${label}を追加`} aria-disabled={full} className={`ac-palette-item${spec.suggestion ? " is-ai" : ""}${drag?.spec?.type === spec.type && drag.spec.suggestion?.code === spec.suggestion?.code ? " is-source" : ""}`} onPointerDown={(event) => beginPointer(event, { spec, label, type: spec.type })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); add(spec); } }}><span className="ac-palette-icon"><Icon name={definition.icon} size="sm" /></span><span><strong>{label}</strong><span className="ac-caption">{description}</span></span><Icon name="drag_indicator" size="sm" /></div>;
  }

  return <div className="ac-builder" data-guide="ai-builder-fields">
    <aside className="ac-palette" aria-label="部品パレット"><h3>フィールドを追加</h3><p className="ac-caption">ドラッグしてフォームに置きます。クリックで末尾に追加</p>{FIELD_TYPES.map((type) => palette({ type: type.type }, type.label, type.description))}
      {draft.suggestions.length > 0 && <><h3 className="ac-suggestion-heading">✧ AIのおすすめ</h3>{draft.suggestions.map((suggestion) => palette({ type: suggestion.fieldType, suggestion }, suggestion.name, `${typeDefinition(suggestion.fieldType).label}${suggestion.reason ? `・${suggestion.reason}` : ""}`))}</>}
      {full && <p className="ac-error">上限の10個に達しています。追加するには既存の項目を削除してください。</p>}
    </aside>
    <section className="ac-form-builder"><div className="ac-form-heading"><div><h3>{view === "form" ? "フォーム" : "フィールド一覧"}</h3><p className="ac-caption">カードの左右の端に置くと2列に並びます</p></div><span className="ac-count">{fields.length} / 10</span><div className="ac-segment" role="group" aria-label="表示切替"><button type="button" aria-pressed={view === "form"} onClick={() => setView("form")}>フォーム</button><button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>表</button></div></div>
      {compact && <button type="button" className="ac-button ac-properties-open" onClick={() => setDrawerOpen(true)}>項目の設定と作成内容</button>}
      {view === "form" ? <div ref={canvas} className={`ac-canvas${drag ? " is-dragging" : ""}${drag && !drag.id && drag.target ? " is-over" : ""}`} aria-label="フォームの項目">
        {draft.layout.map((formRow, rowIndex) => <div key={rowIndex} className={`ac-form-row cols-${formRow.cols}`} data-form-row={rowIndex}>
          {formRow.items.map((id) => { const field = draft.fields[id]; const definition = typeDefinition(field.fieldType); const highlight = highlights[field.code]; return <article key={id} tabIndex={0} role="listitem" aria-label={`${field.name}、${definition.label}${field.required ? "、必須" : ""}${formRow.cols === 2 ? "、2列" : ""}。Alt＋矢印キーで移動`} className={`ac-field-card${selected?.id === id ? " is-selected" : ""}${freshId === id ? " is-new" : ""}${drag?.id === id ? " is-source" : ""}${highlight === "追加" ? " is-added" : highlight === "変更" ? " is-changed" : ""}${drag?.target?.row === rowIndex && drag.target.position === "slot" && drag.target.index === formRow.items.indexOf(id) ? " is-target" : ""}`} data-field-id={id} onPointerDown={(event) => beginPointer(event, { id, label: field.name, type: field.fieldType })} onKeyDown={(event) => keyboard(event, id)}>
            <span className="ac-card-grip"><Icon name="drag_indicator" size="sm" /></span><div className="ac-field-label"><strong>{field.name || "表示名未入力"}</strong>{field.required && <span className="ac-required">*</span>}{field.source === "ai" && <span className="ac-ai-badge">✧ AI</span>}{highlight && <span className="ac-change-label">{highlight}</span>}</div><span className="ac-field-type" title={definition.label}><Icon name={definition.icon} size="sm" />{formRow.cols === 1 && definition.label}</span><FieldMock field={field} />
            <div className="ac-card-actions"><button type="button" aria-label={formRow.cols === 1 ? "2列にする" : "全幅にする"} onClick={() => changeLayout(setFieldColumns(draft.layout, id, formRow.cols === 1 ? 2 : 1), id)}><Icon name={formRow.cols === 1 ? "view_column" : "crop_landscape"} size="sm" /></button><button type="button" aria-label="複製" aria-disabled={full} onClick={() => duplicate(id)}><Icon name="add" size="sm" /></button><button type="button" aria-label="削除" disabled={fields.length === 1} onClick={() => remove(id)}><Icon name="delete" size="sm" /></button></div>
          </article>; })}
          {formRow.cols === 2 && formRow.items.length === 1 && <div data-empty-slot={rowIndex} className={`ac-empty-slot${drag?.target?.row === rowIndex && drag.target.position === "slot" && drag.target.index === 1 ? " is-target" : ""}`}><Icon name="add" size="sm" /><span>ここにドラッグ</span><button type="button" onClick={() => changeLayout(setFieldColumns(draft.layout, formRow.items[0], 1), formRow.items[0])}>1列に戻す</button></div>}
        </div>)}
        <div className="ac-endzone" data-endzone><Icon name="add" />{full ? "上限に達しています" : "ここにドラッグして追加"}</div>
        {drag?.indicator && <div className={`ac-drop-indicator ${drag.target?.position === "left" || drag.target?.position === "right" ? "vertical" : "horizontal"}`} style={drag.indicator} aria-hidden="true">{["left", "right"].includes(drag.target?.position ?? "") && <span>横に並べる</span>}</div>}
      </div> : <div ref={canvas} className="ac-table-wrap"><table className="ac-fields-table"><thead><tr><th aria-label="並べ替え" /><th>表示名</th><th>コード</th><th>型</th><th>必須</th><th>配置</th><th>削除</th></tr></thead><tbody>{fields.map((field) => <tr key={field.id} data-table-field data-field-id={field.id} tabIndex={0} onKeyDown={(event) => keyboard(event, field.id)}><td><div role="button" tabIndex={0} className="ac-table-grip" aria-label={`${field.name}を並べ替え`} onPointerDown={(event) => beginPointer(event, { id: field.id, label: field.name, type: field.fieldType })} onKeyDown={(event) => keyboard(event, field.id)}><Icon name="drag_indicator" size="sm" /></div></td><td><input aria-label={`${field.name}の表示名`} value={field.name} onFocus={() => setSelectedId(field.id)} onChange={(event) => updateField(field.id, { name: event.target.value })} />{field.reason && <p className="ac-caption">✧ {field.reason}</p>}</td><td><input className="ac-code" aria-label={`${field.name}のコード`} value={field.code} aria-invalid={Boolean(fieldCodeError(field, fields))} onChange={(event) => updateField(field.id, { code: event.target.value })} /><p className="ac-error">{fieldCodeError(field, fields)}</p></td><td><select aria-label={`${field.name}の型`} value={field.fieldType} onChange={(event) => updateField(field.id, { fieldType: event.target.value as GeneratedBlueprintFieldType })}>{FIELD_TYPES.map((type) => <option key={type.type} value={type.type}>{type.label}</option>)}</select></td><td><input aria-label={`${field.name}の必須`} type="checkbox" checked={field.required} onChange={(event) => updateField(field.id, { required: event.target.checked })} /></td><td>{draft.layout[locateField(draft.layout, field.id)!.row].cols === 2 ? "2列" : "全幅"}</td><td><button type="button" className="ac-icon-button" aria-label={`${field.name}を削除`} disabled={fields.length === 1} onClick={() => remove(field.id)}><Icon name="delete" size="sm" /></button></td></tr>)}</tbody></table><div className="ac-endzone" data-endzone>{full ? "上限に達しています" : "ここにドラッグして追加"}</div>{drag?.indicator && <div className="ac-drop-indicator horizontal" style={drag.indicator} aria-hidden="true" />}</div>}
    </section>
    {!compact && <aside className="ac-properties">{properties}</aside>}
    {compact && drawerOpen && <CreationDialog title="項目の設定と作成内容" drawer onClose={() => setDrawerOpen(false)}>{properties}</CreationDialog>}
    {drag && <div className="ac-drag-ghost" style={{ left: drag.x + 14, top: drag.y - 20 }} aria-hidden="true"><Icon name={typeDefinition(drag.type).icon} size="sm" />{drag.label}<span className="ac-badge">{typeDefinition(drag.type).label}</span></div>}
    <div className="ac-sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
    {toast && <div className="ac-toast" role="status">{toast}</div>}
  </div>;
}

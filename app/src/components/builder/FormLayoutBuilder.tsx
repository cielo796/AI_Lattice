"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Icon } from "@/components/shared/Icon";
import { applyFormRows, formRowsFromFields, type FormLayoutField } from "@/lib/form-layout";
import { hitTestDrop, locateField, moveFieldByKeyboard, placeField, setFieldColumns, type DropTarget, type FormRow } from "@/lib/blueprint-layout";
import type { AppField, FieldType } from "@/types/app";
import "./form-layout-builder.css";

const TYPES: Record<FieldType, { label: string; icon: string; placeholder: string }> = {
  text: { label: "テキスト", icon: "text_fields", placeholder: "テキストを入力" },
  textarea: { label: "長文テキスト", icon: "notes", placeholder: "複数行のテキストを入力" },
  number: { label: "数値", icon: "tag", placeholder: "0" },
  date: { label: "日付", icon: "calendar_today", placeholder: "年 / 月 / 日" },
  datetime: { label: "日時", icon: "schedule", placeholder: "年 / 月 / 日　時:分" },
  boolean: { label: "真偽値", icon: "toggle_on", placeholder: "オフ" },
  select: { label: "選択式", icon: "list", placeholder: "選択してください" },
  user_ref: { label: "ユーザー参照", icon: "person", placeholder: "ユーザーを選択" },
  master_ref: { label: "他テーブル参照", icon: "database", placeholder: "参照先を選択" },
  file: { label: "ファイル", icon: "attach_file", placeholder: "ファイルを追加" },
  ai_generated: { label: "AI生成", icon: "auto_awesome", placeholder: "AIが生成します" },
  calculated: { label: "計算式", icon: "functions", placeholder: "自動計算されます" },
};

type DragState = { code: string; x: number; y: number; target: DropTarget | null; indicator?: CSSProperties };

export function FormLayoutBuilder({ fields, value, onChange, disabled = false, palette, settings, selectedField, onSelect, onDuplicate, onRemove }: {
  fields: AppField[];
  value: FormLayoutField[];
  onChange: (value: FormLayoutField[]) => void;
  disabled?: boolean;
  palette?: { items: Array<{ type: FieldType; label: string; description: string; icon: string }>; onAdd: (type: FieldType, target: DropTarget) => void };
  settings?: ReactNode;
  selectedField?: string;
  onSelect?: (code: string, openSettings: boolean) => void;
  onDuplicate?: (code: string) => void;
  onRemove?: (code: string) => void;
}) {
  const rows = formRowsFromFields(value);
  const fieldByCode = new Map(fields.map((field) => [field.code, field]));
  const [selectedCode, setSelectedCode] = useState(value.find((field) => field.visible)?.fieldCode ?? "");
  const activeCode = selectedField ?? selectedCode;
  const selected = fieldByCode.get(activeCode) ?? fields[0];
  const configuration = value.find((field) => field.fieldCode === selected?.code);
  const location = selected ? locateField(rows, selected.code) : null;
  const selectedRow = location ? rows[location.row] : null;
  const [announcement, setAnnouncement] = useState("");
  const [focusRequest, setFocusRequest] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const cleanupDrag = useRef<(() => void) | null>(null);
  const controlId = useId();

  useEffect(() => () => cleanupDrag.current?.(), []);
  useEffect(() => { if (disabled) cleanupDrag.current?.(); }, [disabled]);
  useLayoutEffect(() => {
    if (focusRequest) canvas.current?.querySelector<HTMLElement>(`[data-layout-field="${activeCode}"]`)?.focus();
  }, [focusRequest, activeCode]);

  function select(code: string, openSettings = false) { setSelectedCode(code); onSelect?.(code, openSettings); }

  function changeRows(nextRows: FormRow[], code: string, action = "移動") {
    if (disabled) return;
    onChange(applyFormRows(nextRows, value));
    select(code);
    const next = locateField(nextRows, code);
    if (next) setAnnouncement(`${fieldByCode.get(code)?.name}を${next.row + 1}行目に${action}しました${nextRows[next.row].cols === 2 ? "（2列）" : "（全幅）"}`);
  }

  function choose(code: string) {
    if (disabled) return;
    if (!locateField(rows, code)) changeRows(placeField(rows, code, { row: rows.length, position: "end" }), code, "追加");
    select(code, true);
  }

  function hide(code: string) {
    const field = fieldByCode.get(code);
    if (disabled || !field) return;
    if (field.required) { setAnnouncement("テーブルの必須項目は非表示にできません。"); return; }
    const nextRows = rows.map((row) => ({ ...row, items: row.items.filter((item) => item !== code) })).filter((row) => row.items.length);
    onChange(applyFormRows(nextRows, value));
    setAnnouncement(`${field.name}をフォームから非表示にしました。テーブルの項目やデータは削除していません。`);
  }

  function update(patch: Partial<FormLayoutField>) {
    if (disabled || !selected) return;
    onChange(value.map((field) => field.fieldCode === selected.code ? { ...field, ...patch } : field));
  }

  function keyboard(event: KeyboardEvent<HTMLElement>, code: string) {
    if (disabled || event.target !== event.currentTarget) return;
    if (event.altKey && event.key.startsWith("Arrow")) {
      event.preventDefault();
      changeRows(moveFieldByKeyboard(rows, code, event.key), code);
      setFocusRequest((current) => current + 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault(); select(code, true);
    } else if (event.key === "Delete") { event.preventDefault(); if (onRemove) onRemove(code); else hide(code); }
  }

  function beginPointer(event: PointerEvent<HTMLElement>, code: string, type?: FieldType) {
    if (disabled || event.button !== 0 || (event.target as HTMLElement).closest("button,input,select,textarea")) return;
    event.preventDefault(); cleanupDrag.current?.(); event.currentTarget.focus();
    const source = event.currentTarget;
    const pointerId = event.pointerId, startX = event.clientX, startY = event.clientY;
    source.setPointerCapture(pointerId);
    let started = false;
    let target: DropTarget | null = null;

    function cleanup() {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel); window.removeEventListener("keydown", escape);
      if (source.hasPointerCapture(pointerId)) source.releasePointerCapture(pointerId);
      cleanupDrag.current = null; setDrag(null);
    }
    function cancel() { cleanup(); setAnnouncement("ドラッグを取り消しました"); }
    function escape(key: globalThis.KeyboardEvent) { if (key.key === "Escape") { key.preventDefault(); cancel(); } }
    function measure(clientX: number, clientY: number) {
      const element = canvas.current;
      if (!element) return { target: null };
      const bounds = element.getBoundingClientRect();
      const geometry = Array.from(element.querySelectorAll<HTMLElement>("[data-layout-row]")).map((row) => ({ rect: row.getBoundingClientRect(), cells: Array.from(row.querySelectorAll<HTMLElement>("[data-layout-field],[data-layout-slot]")).map((cell) => ({ rect: cell.getBoundingClientRect(), id: cell.dataset.layoutField })) }));
      const hit = hitTestDrop(rows, geometry, bounds, clientX, clientY, locateField(rows, code) ? code : undefined);
      let indicator: CSSProperties | undefined;
      if (hit && !["self", "slot"].includes(hit.position)) {
        const side = hit.position === "left" || hit.position === "right";
        const rect = hit.position === "end" ? element.querySelector<HTMLElement>("[data-layout-end]")!.getBoundingClientRect() : side ? geometry[hit.row].cells.find((cell) => cell.id !== code)!.rect : geometry[hit.row].rect;
        indicator = side ? { left: (hit.position === "left" ? rect.left - 5 : rect.right + 2) - bounds.left, top: rect.top - bounds.top, height: rect.bottom - rect.top } : { left: 10, right: 10, top: (hit.position === "before" || hit.position === "end" ? rect.top - 5 : rect.bottom + 3) - bounds.top };
      }
      return { target: hit, indicator };
    }
    function move(pointer: globalThis.PointerEvent) {
      if (pointer.pointerId !== pointerId) return;
      if (!started && Math.abs(pointer.clientX - startX) + Math.abs(pointer.clientY - startY) < 5) return;
      started = true;
      if (pointer.clientY > window.innerHeight - 48) window.scrollBy(0, 14);
      else if (pointer.clientY < 64) window.scrollBy(0, -14);
      const measured = measure(pointer.clientX, pointer.clientY); target = measured.target;
      setDrag({ code, x: pointer.clientX, y: pointer.clientY, ...measured });
    }
    function finish(pointer: globalThis.PointerEvent) {
      if (pointer.pointerId !== pointerId) return;
      if (started) target = measure(pointer.clientX, pointer.clientY).target;
      cleanup();
      if (!started) { if (type) palette?.onAdd(type, { row: rows.length, position: "end" }); else choose(code); return; }
      if (!target) { setAnnouncement("ドラッグを取り消しました"); return; }
      if (type) palette?.onAdd(type, target);
      else if (target.position === "self") select(code, true);
      else changeRows(placeField(rows, code, target), code, locateField(rows, code) ? "移動" : "追加");
    }
    cleanupDrag.current = cleanup;
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel); window.addEventListener("keydown", escape);
  }

  return <div className={`form-layout-builder${palette ? " is-design-builder" : ""}`} aria-label="フォームの配置">
    <div className="fl-heading"><div><h4>ドラッグでフォームを配置</h4><p>上下に移動すると順番を変更。カードの左右端に置くと2列になります。</p></div><span className="fl-count">{rows.reduce((count, row) => count + row.items.length, 0)} / {fields.length}項目を表示</span></div>
    <div className="fl-workspace">
      <aside className="fl-library" aria-label="配置できる項目" data-guide={palette ? "builder-design-palette" : undefined}>
        <h5>{palette ? "フィールドを追加" : "テーブルの項目"}</h5><p>{palette ? "部品をドラッグしてフォームに配置。クリックでも末尾に追加できます。" : "ドラッグして配置。非表示の項目はクリックでも末尾へ追加できます。"}</p>
        {palette?.items.map((item) => <div key={item.type} role="button" tabIndex={disabled ? -1 : 0} aria-label={`${item.label}を追加`} aria-disabled={disabled} className="fl-library-item" data-design-type={item.type} onPointerDown={(event) => beginPointer(event, item.type, item.type)} onClick={(event) => { if (!disabled && event.detail === 0) palette.onAdd(item.type, { row: rows.length, position: "end" }); }} onKeyDown={(event) => { if (!disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); palette.onAdd(item.type, { row: rows.length, position: "end" }); } }}><Icon name={item.icon} size="sm" /><div><strong>{item.label}</strong><small>{item.description}</small></div><Icon name="drag_indicator" size="sm" /></div>)}
        {palette && fields.some((field) => !locateField(rows, field.code)) && <h5>非表示の項目</h5>}
        {fields.filter((field) => !palette || !locateField(rows, field.code)).map((field) => <div key={field.code} role="button" tabIndex={disabled ? -1 : 0} aria-label={`${field.name}を配置`} aria-disabled={disabled} className={`fl-library-item${selected?.code === field.code ? " is-selected" : ""}`} data-layout-palette={field.code} onPointerDown={(event) => beginPointer(event, field.code)} onClick={(event) => { if (event.detail === 0) choose(field.code); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(field.code); } }}><Icon name={TYPES[field.fieldType].icon} size="sm" /><div><strong>{field.name}</strong><small>{TYPES[field.fieldType].label} · {locateField(rows, field.code) ? "配置済み" : "非表示"}</small></div><Icon name="drag_indicator" size="sm" /></div>)}
        {!fields.length && !palette && <p>「新規フィールド」で項目を追加してください。</p>}
      </aside>
      <div className="fl-main">
        <div ref={canvas} className={`fl-canvas${drag ? " is-dragging" : ""}`} role="list" aria-label="フォームの項目配置" data-guide={palette ? "builder-design-canvas" : undefined}>
          {rows.map((row, rowIndex) => <div className={`fl-row cols-${row.cols}`} key={rowIndex} data-layout-row={rowIndex}>
            {row.items.map((code) => {
              const field = fieldByCode.get(code);
              const settings = value.find((item) => item.fieldCode === code);
              if (!field) return null;
              const removable = !field.required || (!!onRemove && field.id.startsWith("new:"));
              return <article key={code} role="listitem" tabIndex={disabled ? -1 : 0} aria-label={`${field.name}、${TYPES[field.fieldType].label}、${row.cols === 2 ? "2列" : "全幅"}${settings?.required ? "、必須" : ""}。Alt＋矢印キーで移動`} data-layout-field={code} className={`fl-card${selected?.code === code ? " is-selected" : ""}${drag?.code === code ? " is-source" : ""}${drag?.target?.row === rowIndex && drag.target.position === "slot" && drag.target.index === row.items.indexOf(code) ? " is-target" : ""}`} onPointerDown={(event) => beginPointer(event, code)} onKeyDown={(event) => keyboard(event, code)}>
                <div className="fl-card-label"><Icon name="drag_indicator" size="sm" /><strong>{field.name}</strong>{settings?.required && <span className="fl-required" aria-hidden="true">*</span>}<span className="fl-type" title={TYPES[field.fieldType].label}><Icon name={TYPES[field.fieldType].icon} size="sm" /></span></div>
                <div className={`fl-mock${field.fieldType === "textarea" ? " is-long" : ""}`} aria-hidden="true">{field.fieldType === "select" && Array.isArray(field.settingsJson?.options) ? String(field.settingsJson.options[0] ?? "選択してください") : TYPES[field.fieldType].placeholder}{field.fieldType === "select" && <Icon name="expand_more" size="sm" />}</div>
                {settings?.helpText && <p className="fl-help">{settings.helpText}</p>}
                <div className="fl-card-actions"><button type="button" disabled={disabled} aria-label={`${field.name}を${row.cols === 2 ? "全幅" : "2列"}にする`} onClick={() => changeRows(setFieldColumns(rows, code, row.cols === 2 ? 1 : 2), code)}><Icon name={row.cols === 2 ? "crop_landscape" : "view_column"} size="sm" /></button>{onDuplicate && <button type="button" disabled={disabled || !palette?.items.some((item) => item.type === field.fieldType)} aria-label={`${field.name}を複製`} onClick={() => onDuplicate(code)}><Icon name="content_copy" size="sm" /></button>}<button type="button" disabled={disabled || !removable} aria-label={`${field.name}を${onRemove && field.id.startsWith("new:") ? "削除" : "非表示"}にする`} onClick={() => onRemove ? onRemove(code) : hide(code)}><Icon name={onRemove && field.id.startsWith("new:") ? "delete" : "visibility_off"} size="sm" /></button></div>
              </article>;
            })}
            {row.cols === 2 && row.items.length === 1 && <div data-layout-slot={rowIndex} className={`fl-slot${drag?.target?.row === rowIndex && drag.target.position === "slot" ? " is-target" : ""}`}><Icon name="add" size="sm" /><span>ここにドラッグ</span><button type="button" disabled={disabled} onClick={() => changeRows(setFieldColumns(rows, row.items[0], 1), row.items[0])}>全幅に戻す</button></div>}
          </div>)}
          <div className="fl-endzone" data-layout-end><Icon name="add" size="sm" />{rows.length ? "ここにドラッグして末尾へ" : "項目をドラッグして配置してください"}</div>
          {drag?.indicator && <div className={`fl-indicator${["left", "right"].includes(drag.target?.position ?? "") ? " is-vertical" : ""}${drag.target?.position === "right" ? " is-right" : ""}`} style={drag.indicator} aria-hidden="true">{["left", "right"].includes(drag.target?.position ?? "") && <span>横に並べる</span>}</div>}
        </div>
        {!settings && selected && configuration && <section className="fl-settings" aria-label={`${selected.name}のフォーム設定`}>
          <div className="fl-settings-heading"><h5>{selected.name}の設定</h5><code>{selected.code}</code></div>
          <div className="fl-controls"><label><input type="checkbox" checked={configuration.visible} disabled={disabled || selected.required} onChange={(event) => { if (event.target.checked) choose(selected.code); else hide(selected.code); }} />フォームに表示</label><label><input type="checkbox" checked={configuration.required} disabled={disabled || selected.required || !configuration.visible} onChange={(event) => update({ required: event.target.checked })} />フォームで必須</label></div>
          {selected.required && <p>テーブルの必須項目のため、非表示・必須解除はできません。</p>}
          <div className="fl-width" role="group" aria-label={`${selected.name}の配置`}><button type="button" aria-pressed={selectedRow?.cols === 1} disabled={disabled || !configuration.visible} onClick={() => changeRows(setFieldColumns(rows, selected.code, 1), selected.code)}>全幅</button><button type="button" aria-pressed={selectedRow?.cols === 2} disabled={disabled || !configuration.visible} onClick={() => changeRows(setFieldColumns(rows, selected.code, 2), selected.code)}>2列（半分）</button></div>
          <label className="fl-help-control" htmlFor={controlId}>入力時の補足<input id={controlId} value={configuration.helpText} disabled={disabled || !configuration.visible} onChange={(event) => update({ helpText: event.target.value })} /></label>
          <p>配置と表示だけを変更します。テーブルの型・一意制約・レコードは変更しません。</p>
        </section>}
      </div>
      {settings && <aside className="fl-design-settings" aria-label="項目の設定と保存内容">{settings}</aside>}
    </div>
    <p className="fl-keyboard-hint">カードを選び、Alt＋矢印で移動・左右入替、Deleteで{palette ? "削除／非表示" : "非表示"}、Escでドラッグ取消。保存するまで実行画面は変わりません。</p>
    <div className="fl-announcement" role="status" aria-live="polite">{announcement}</div>
    {drag && <div className="fl-ghost" style={{ left: drag.x + 12, top: drag.y + 10 }} aria-hidden="true"><Icon name={TYPES[fieldByCode.get(drag.code)?.fieldType ?? drag.code as FieldType].icon} size="sm" />{fieldByCode.get(drag.code)?.name ?? TYPES[drag.code as FieldType].label}</div>}
  </div>;
}

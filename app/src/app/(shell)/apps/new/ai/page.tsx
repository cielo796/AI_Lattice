"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FieldBuilder } from "@/components/builder/FieldBuilder";
import { CreationDialog } from "@/components/builder/CreationDialog";
import { Icon } from "@/components/shared/Icon";
import { useShellChrome } from "@/components/shared/ShellChrome";
import { apiFetch } from "@/lib/api/client";
import { createAppFromBlueprint, generateAppBlueprint } from "@/lib/api/apps";
import { automaticCode, blueprintDiff, blueprintFromDraft, draftErrors, draftFromAdjustedBlueprint, draftFromBlueprint, preserveEditedDraft, type AppDraft } from "@/lib/app-creation";
import type { BlueprintModelInfo, GeneratedAppBlueprint } from "@/types/ai";
import "@/components/builder/app-creation.css";

const EXAMPLES = [
  { title: "在庫管理", icon: "inventory_2", text: "倉庫の在庫を管理したい。品目ごとに在庫数・保管場所・発注点・入荷日を記録し、担当者が一覧やカレンダーで確認できるアプリ。" },
  { title: "問い合わせ管理", icon: "support_agent", text: "顧客からの問い合わせを管理したい。件名・顧客名・優先度・担当者・対応状況・期限を記録し、サポートチームが状況別に確認できるアプリ。" },
  { title: "経費申請", icon: "receipt_long", text: "社員の経費申請を記録したい。申請者・用途・金額・申請日・承認状況を管理し、マネージャーと経理が一覧や集計で確認できるアプリ。" },
  { title: "備品貸出", icon: "devices", text: "社内の備品貸出を管理したい。備品名・利用者・貸出日・返却予定日・返却済みかを記録し、総務が一覧で確認できるアプリ。" },
  { title: "案件管理", icon: "work", text: "営業案件を管理したい。案件名・顧客名・担当者・見込み金額・商談ステージ・次回連絡日を記録し、営業チームがカンバンや集計で確認できるアプリ。" },
];

function ModelSummary({ info, error }: { info: BlueprintModelInfo | null; error: string }) {
  return <div className="ac-model">使用モデル：{info ? <><strong>{info.model}</strong><span>{info.source === "template" ? `（Prompt Template「${info.templateName ?? "有効なテンプレート"}」の指定）` : "（管理画面の既定モデル）"}</span></> : <span>{error || "サーバーに確認中…"}</span>}<Link className="ac-link" href="/admin/openai">管理画面で変更</Link></div>;
}

export default function NewAIAppPage() {
  const router = useRouter();
  const { isSidebarCollapsed, toggleMobileNav } = useShellChrome();
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<AppDraft | null>(null);
  const [describeAgain, setDescribeAgain] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [instruction, setInstruction] = useState("");
  const [edited, setEdited] = useState(false);
  const [modelInfo, setModelInfo] = useState<BlueprintModelInfo | null>(null);
  const [modelError, setModelError] = useState("");
  const [error, setError] = useState("");
  const [replacement, setReplacement] = useState<string | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, setPending] = useState<GeneratedAppBlueprint | null>(null);
  const [highlights, setHighlights] = useState<Record<string, "追加" | "変更">>({});
  const request = useRef<AbortController | null>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const review = Boolean(draft && !describeAgain && !isGenerating);
  const busy = isGenerating || isAdjusting || isSaving;
  const step = isSaving ? 3 : review ? 2 : 1;
  const errors = draft ? draftErrors(draft) : [];
  const changes = pending && draft ? blueprintDiff(blueprintFromDraft(draft), pending) : [];

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<BlueprintModelInfo>("/api/apps/generate", { signal: controller.signal }).then(setModelInfo).catch(() => { if (!controller.signal.aborted) setModelError("モデル設定を取得できません。再生成時に再確認します。"); });
    return () => { controller.abort(); request.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!isGenerating) return;
    const timer = setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => clearInterval(timer);
  }, [isGenerating]);

  function updateDraft(next: AppDraft) { setDraft(next); setEdited(true); setError(""); }
  function cancelRequest() { request.current?.abort(); request.current = null; setIsGenerating(false); setIsAdjusting(false); setError(""); }
  async function generate(mode: "replace" | "preserve" | "adjust" = "replace") {
    const text = mode === "adjust" ? instruction.trim() : prompt.trim();
    if (!text || busy || pending || request.current) return;
    if (mode !== "replace" && errors.length) { setError(errors[0]); return; }
    const controller = new AbortController(); request.current = controller;
    setError(""); setElapsed(0); setConfirmRegenerate(false);
    if (mode === "adjust") setIsAdjusting(true); else setIsGenerating(true);
    try {
      const info = await apiFetch<BlueprintModelInfo>("/api/apps/generate", { signal: controller.signal });
      if (controller.signal.aborted) return;
      setModelInfo(info); setModelError("");
      const generated = await generateAppBlueprint(text, { signal: controller.signal, ...(mode !== "replace" && draft ? { blueprint: blueprintFromDraft(draft) } : {}) });
      if (request.current !== controller || controller.signal.aborted) return;
      if (mode === "adjust") setPending(generated);
      else {
        const incoming = draftFromBlueprint(generated);
        setDraft(mode === "preserve" && draft ? preserveEditedDraft(draft, incoming) : incoming);
        setDescribeAgain(false); setEdited(mode === "preserve"); setHighlights({});
      }
    } catch (failure) {
      if (!controller.signal.aborted && request.current === controller) setError(failure instanceof Error ? failure.message : "設計案を生成できませんでした。");
    } finally {
      if (request.current === controller) { request.current = null; setIsGenerating(false); setIsAdjusting(false); }
    }
  }
  function regenerate() { if (edited && draft) setConfirmRegenerate(true); else void generate(); }
  function insertExample(text: string) {
    if (prompt.trim() && prompt !== text) setReplacement(text);
    else { setPrompt(text); promptInput.current?.focus(); }
  }
  async function save() {
    if (!draft || busy || pending || errors.length) return;
    setIsSaving(true); setError("");
    try { const app = await createAppFromBlueprint(blueprintFromDraft(draft)); router.push(`/apps/${app.id}/tables?created=1`); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "アプリを作成できませんでした。"); setIsSaving(false); }
  }
  function applyAdjustment() {
    if (!pending || !draft) return;
    const marks: Record<string, "追加" | "変更"> = {};
    for (const change of changes) if (change.code && change.kind !== "削除") marks[change.code] = change.kind;
    const next = draftFromAdjustedBlueprint(draft, pending, Object.keys(marks));
    const validation = draftErrors(next);
    if (validation.length) { setError(validation[0]); setPending(null); return; }
    setDraft(next); setHighlights(marks); setPending(null); setInstruction(""); setEdited(true);
  }

  return <div className="app-creation" style={{ "--ac-sidebar-width": isSidebarCollapsed ? "72px" : "232px" } as CSSProperties}>
    <header className="ac-header"><div className="ac-breadcrumb"><button type="button" className="ac-icon-button ac-mobile-menu" aria-label="ナビゲーションを開く" onClick={toggleMobileNav}><Icon name="menu" /></button><span>ビルダー</span><Icon name="chevron_right" size="sm" /><strong>AIで新しいアプリを作成</strong></div><button className="ac-button ac-ghost" type="button" disabled={isSaving} onClick={() => { if (draft || prompt.trim() || busy) setConfirmCancel(true); else router.push("/apps"); }}>キャンセル</button></header>
    <main className={`ac-main${!review && !isGenerating ? " ac-describe" : ""}`}><ol className="ac-steps" aria-label="アプリ作成の手順">{["説明する", "設計を確認・編集", "下書きとして作成"].map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={step > index + 1 ? "is-done" : ""}><span className="ac-step-number">{step > index + 1 ? "✓" : index + 1}</span>{label}</li>)}</ol>
      <h1>{isSaving ? "下書きとして作成しています" : isGenerating ? "設計案を生成しています" : review ? "設計案を確認してください" : "どんなアプリを作りますか？"}</h1>
      <p className="ac-subtitle">{review ? "AIの提案が並んでいます。左の部品をドラッグして項目を足し、カードをつかんで並べ替えます。カードの左右の端に置くと2列に並びます。" : "扱う情報や使う人を説明すると、AIが編集可能な設計案を作成します。"}</p>
      {(review || isGenerating) && <ModelSummary info={modelInfo} error={modelError} />}
      {error && <div className="ac-error-banner" role="alert">{error}</div>}
      {!review && !isGenerating && <div className="ac-description-layout"><section className="ac-panel"><div className="ac-control" data-guide="ai-builder-prompt"><label htmlFor="creation-prompt">作りたいアプリの説明</label><textarea ref={promptInput} id="creation-prompt" className="ac-description-input" maxLength={1000} value={prompt} placeholder="例：倉庫の在庫を管理したい。品目ごとに在庫数・保管場所・発注点を記録し、担当者が一覧で確認できるアプリ。" onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); regenerate(); } }} /><p className="ac-caption ac-counter" aria-live="polite">{prompt.length} / 1000文字</p></div><div className="ac-hints"><div><strong>扱う情報</strong><p className="ac-caption">何を記録・管理しますか？</p></div><div><strong>使う人</strong><p className="ac-caption">誰が入力・確認しますか？</p></div><div><strong>見たい形</strong><p className="ac-caption">一覧・カンバン・集計など</p></div></div><p className="ac-info">作成されるのは 1アプリ・1テーブル、フィールドは 1〜10個 です。作成後は下書きとして保存され、サンプルレコード3件が入ります。</p><ModelSummary info={modelInfo} error={modelError} /><div className="ac-buttons" style={{ marginTop: "var(--space-5)" }}><button type="button" className="ac-button ac-primary" disabled={!prompt.trim() || busy} onClick={regenerate} data-guide="ai-builder-generate"><Icon name="auto_awesome" size="sm" />設計案を生成</button><span className="ac-caption">{prompt.trim() ? "⌘ / Ctrl＋Enter" : "説明を入力してください"}</span>{draft && <button type="button" className="ac-button ac-ghost" onClick={() => setDescribeAgain(false)}>編集に戻る</button>}</div></section><section><h2>入力例から始める</h2><p className="ac-caption">クリックで入力欄に挿入します。生成はまだ始まりません。</p><div className="ac-example-list">{EXAMPLES.map((example) => <button type="button" className="ac-example" key={example.title} onClick={() => insertExample(example.text)}><Icon name={example.icon} /><span><strong>{example.title}</strong><span className="ac-caption">{example.text}</span><span className="ac-example-link">入力欄に入れる</span></span></button>)}</div></section></div>}
      {isGenerating && <div className="ac-progress" role="status"><section className="ac-panel"><h2>設計案を組み立てています</h2><p className="ac-caption">段階表示は経過時間に基づく目安です。結果が届いたら編集できます。</p><ol>{["アプリ名・コード", "テーブル", "フィールド", "表示とサンプル"].map((label, index) => { const stage = Math.min(3, Math.floor(elapsed / 6)); return <li key={label} className={index < stage ? "is-done" : index === stage ? "is-active" : ""}><span className="ac-step-number">{index < stage ? "✓" : index + 1}</span><div><strong>{label}</strong><p className="ac-caption">{index < stage ? ["アプリの基本情報を検討しました", "1つの業務テーブルに構成します", "1〜10個の項目と配置を整理します"][index] : index === stage ? "構成案を検討中…" : "待機中"}</p></div></li>; })}</ol><button type="button" className="ac-button" onClick={cancelRequest}>生成をやめる</button></section><section className="ac-panel" aria-label="生成結果のプレビュー"><div className="ac-skeleton" style={{ width: "60%" }} />{[1, 2, 3].map((index) => <div className="ac-skeleton-card" key={index}><div className="ac-skeleton" style={{ width: "40%" }} /><div className="ac-skeleton" /></div>)}</section></div>}
      {review && draft && <fieldset data-guide="ai-builder-blueprint" disabled={isSaving || isAdjusting || Boolean(pending)} inert={isSaving || isAdjusting || Boolean(pending)}><section className="ac-panel ac-metadata"><div className="ac-metadata-grid"><div className="ac-control"><label htmlFor="creation-app-name">アプリ名</label><input id="creation-app-name" value={draft.name} onChange={(event) => updateDraft({ ...draft, name: event.target.value, code: draft.codeAuto ? automaticCode(event.target.value, draft.code, "-") : draft.code })} /></div><div className="ac-control"><label htmlFor="creation-app-code">アプリコード <span className="ac-auto">{draft.codeAuto ? "自動" : "手動"}</span></label><input id="creation-app-code" className="ac-code" value={draft.code} onChange={(event) => updateDraft({ ...draft, code: event.target.value, codeAuto: false })} /></div><div className="ac-control"><label htmlFor="creation-table-name">テーブル名</label><input id="creation-table-name" value={draft.table.name} onChange={(event) => updateDraft({ ...draft, table: { ...draft.table, name: event.target.value, code: draft.table.codeAuto ? automaticCode(event.target.value, draft.table.code, "-") : draft.table.code } })} /></div><div className="ac-control"><label htmlFor="creation-table-code">テーブルコード <span className="ac-auto">{draft.table.codeAuto ? "自動" : "手動"}</span></label><input id="creation-table-code" className="ac-code" value={draft.table.code} onChange={(event) => updateDraft({ ...draft, table: { ...draft.table, code: event.target.value, codeAuto: false } })} /></div><button type="button" className="ac-button ac-ghost" onClick={() => setDescribeAgain(true)}>説明を直す</button></div><p className="ac-caption">1アプリにつき1テーブルです。・元の説明：{prompt}</p><details><summary className="ac-caption">アプリの説明とAIの設計説明</summary><div className="ac-control"><label htmlFor="creation-app-description">アプリの説明</label><textarea id="creation-app-description" value={draft.description} rows={2} onChange={(event) => updateDraft({ ...draft, description: event.target.value })} /></div><p className="ac-caption">{draft.aiInsight}</p></details></section><FieldBuilder draft={draft} onChange={updateDraft} highlights={highlights} /></fieldset>}
    </main>
    {review && draft && <footer className="ac-footer"><div className="ac-adjustment"><input aria-label="AIで調整" maxLength={1000} value={instruction} disabled={busy || Boolean(pending)} placeholder="✧ AIで調整（例：期限を追加、入荷日を必須に）" onChange={(event) => setInstruction(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void generate("adjust"); } }} /><button className="ac-button" type="button" disabled={!instruction.trim() || busy || Boolean(pending)} onClick={() => void generate("adjust")}>{isAdjusting ? "調整中…" : "差分を確認"}</button></div><button className="ac-button" type="button" disabled={busy || Boolean(pending)} onClick={regenerate}><Icon name="refresh" size="sm" />AIで再生成</button><button className="ac-button ac-primary" type="button" disabled={busy || Boolean(pending) || errors.length > 0} onClick={() => void save()}><Icon name="draft" size="sm" />{isSaving ? "作成中…" : "下書きとして作成"}</button>{isAdjusting && <button className="ac-button ac-ghost" type="button" onClick={cancelRequest}>調整をやめる</button>}{errors.length > 0 && <p className="ac-save-status">作成できない理由：{errors[0]}</p>}</footer>}
    {replacement && <CreationDialog title="説明を置き換えますか？" onClose={() => setReplacement(null)}><p>入力済みの説明を、この入力例で置き換えます。生成は始まりません。</p><div className="ac-buttons"><button type="button" className="ac-button" onClick={() => setReplacement(null)}>戻る</button><button type="button" className="ac-button ac-primary" onClick={() => { setPrompt(replacement); setReplacement(null); requestAnimationFrame(() => promptInput.current?.focus()); }}>置き換える</button></div></CreationDialog>}
    {confirmRegenerate && <CreationDialog title="編集内容を残して再生成しますか？" onClose={() => setConfirmRegenerate(false)}><p>編集を残す場合、手で変更した項目・追加した項目・現在の配置を維持します。全体を作り直すと現在の編集内容は失われます。</p><div className="ac-buttons"><button type="button" className="ac-button" onClick={() => void generate("replace")}>全体を作り直す</button><button type="button" className="ac-button ac-primary" onClick={() => void generate("preserve")}>編集を残して再生成</button></div></CreationDialog>}
    {confirmCancel && <CreationDialog title="作成をキャンセルしますか？" onClose={() => setConfirmCancel(false)}><p>未保存の説明・設計案・編集内容は破棄されます。</p><div className="ac-buttons"><button type="button" className="ac-button" onClick={() => setConfirmCancel(false)}>編集を続ける</button><button type="button" className="ac-button ac-danger-button" onClick={() => { cancelRequest(); router.push("/apps"); }}>作成をキャンセル</button></div></CreationDialog>}
    {pending && <CreationDialog title="AIによる調整の差分" onClose={() => setPending(null)}>{changes.length ? <ul className="ac-diff-list">{changes.map((change, index) => <li key={index} className={change.kind === "追加" ? "ac-diff-added" : change.kind === "削除" ? "ac-diff-removed" : "ac-diff-changed"}><strong>{change.kind}：{change.name}</strong><p>{change.detail}</p></li>)}</ul> : <p>変更はありません。</p>}<div className="ac-buttons"><button type="button" className="ac-button" onClick={() => setPending(null)}>破棄</button><button type="button" className="ac-button ac-primary" onClick={applyAdjustment}>適用する</button></div></CreationDialog>}
  </div>;
}

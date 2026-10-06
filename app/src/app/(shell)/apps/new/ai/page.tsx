"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FieldBuilder } from "@/components/builder/FieldBuilder";
import { CreationDialog } from "@/components/builder/CreationDialog";
import { CreationDescribe, CreationMetadata, CreationProgress, CreationSteps } from "@/components/builder/CreationPanels";
import { Icon } from "@/components/shared/Icon";
import { useShellChrome } from "@/components/shared/ShellChrome";
import { useClientReady } from "@/components/shared/useClientReady";
import { apiFetch } from "@/lib/api/client";
import { createAppFromBlueprint, generateAppBlueprint } from "@/lib/api/apps";
import { blueprintDiff, blueprintFromDraft, draftErrors, draftFromAdjustedBlueprint, draftFromBlueprint, preserveEditedDraft, type AppDraft } from "@/lib/app-creation";
import type { BlueprintModelInfo, GeneratedAppBlueprint } from "@/types/ai";
import "@/components/builder/app-creation.css";

export default function NewAIAppPage() {
  const router = useRouter();
  const ready = useClientReady();
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
    apiFetch<BlueprintModelInfo>("/api/apps/generate", { signal: controller.signal })
      .then((info) => { if (!controller.signal.aborted) setModelInfo(info); })
      .catch(() => { if (!controller.signal.aborted) setModelError("モデル設定を取得できません。生成時に再確認します。"); });
    return () => { controller.abort(); request.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!isGenerating) return;
    const timer = setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => clearInterval(timer);
  }, [isGenerating]);

  function updateDraft(next: AppDraft) {
    setDraft(next); setEdited(true); setError("");
  }

  function cancelRequest() {
    request.current?.abort(); request.current = null;
    setIsGenerating(false); setIsAdjusting(false); setError("");
  }

  async function generate(mode: "replace" | "preserve" | "adjust" = "replace") {
    const text = mode === "adjust" ? instruction.trim() : prompt.trim();
    if (!text || busy || pending || request.current) return;
    if (mode !== "replace" && errors.length) { setError(errors[0]); return; }
    const controller = new AbortController();
    request.current = controller;
    setError(""); setElapsed(0); setConfirmRegenerate(false);
    if (mode === "adjust") setIsAdjusting(true); else setIsGenerating(true);
    try {
      const info = await apiFetch<BlueprintModelInfo>("/api/apps/generate", { signal: controller.signal });
      if (controller.signal.aborted) return;
      setModelInfo(info); setModelError("");
      const generated = await generateAppBlueprint(text, {
        signal: controller.signal,
        ...(mode !== "replace" && draft ? { blueprint: blueprintFromDraft(draft) } : {}),
      });
      if (request.current !== controller || controller.signal.aborted) return;
      if (mode === "adjust") setPending(generated);
      else {
        const incoming = draftFromBlueprint(generated);
        setDraft(mode === "preserve" && draft ? preserveEditedDraft(draft, incoming) : incoming);
        setDescribeAgain(false); setEdited(mode === "preserve"); setHighlights({});
      }
    } catch (failure) {
      if (!controller.signal.aborted && request.current === controller) {
        setError(failure instanceof Error ? failure.message : "設計案を生成できませんでした。");
      }
    } finally {
      if (request.current === controller) {
        request.current = null; setIsGenerating(false); setIsAdjusting(false);
      }
    }
  }

  function regenerate() {
    if (edited && draft) setConfirmRegenerate(true);
    else void generate();
  }

  function insertExample(text: string) {
    if (prompt.trim() && prompt !== text) setReplacement(text);
    else { setPrompt(text); promptInput.current?.focus(); }
  }

  async function save() {
    if (!draft || busy || pending || errors.length) return;
    setIsSaving(true); setError("");
    try {
      const app = await createAppFromBlueprint(blueprintFromDraft(draft));
      router.push(`/apps/${app.id}/tables?created=1`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "アプリを作成できませんでした。");
      setIsSaving(false);
    }
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

  return (
    <div className="app-creation" style={{ "--ac-sidebar-width": isSidebarCollapsed ? "72px" : "232px" } as CSSProperties}>
      <header className="ac-header">
        <nav className="ac-breadcrumb" aria-label="パンくず">
          <button type="button" className="ac-icon-button ac-mobile-menu" aria-label="ナビゲーションを開く" onClick={toggleMobileNav}><Icon name="menu" /></button>
          <span>ビルダー</span><Icon name="chevron_right" size="sm" /><strong>AIで新しいアプリを作成</strong>
        </nav>
        <button className="ac-button ac-ghost" type="button" disabled={isSaving} onClick={() => {
          if (draft || prompt.trim() || busy) setConfirmCancel(true);
          else router.push("/apps");
        }}>キャンセル</button>
      </header>
      <main className={`ac-main${!review ? " ac-describe" : ""}`}>
        <CreationSteps step={step} />
        <h1>{isSaving ? "下書きとして作成しています" : isGenerating ? "設計案を生成しています" : review ? "設計案を確認してください" : "どんなアプリを作りますか？"}</h1>
        <p className="ac-subtitle">{review
          ? "AIの提案が並んでいます。左の部品をドラッグして項目を足し、カードをつかんで並べ替えます。カードの左右の端に置くと2列に並びます。"
          : "文章で説明すると、AIがアプリ名・テーブル・フィールドの設計案を作ります。作成前に自由に直せます。"}</p>
        {error && <div className="ac-error-banner" role="alert"><Icon name="error" size="sm" />{error}</div>}
        {!review && !isGenerating && <CreationDescribe
          prompt={prompt}
          promptInput={promptInput}
          ready={ready && !busy}
          modelInfo={modelInfo}
          modelError={modelError}
          onPromptChange={setPrompt}
          onGenerate={regenerate}
          onExample={insertExample}
          onReview={draft ? () => setDescribeAgain(false) : undefined}
        />}
        {isGenerating && <CreationProgress elapsed={elapsed} onCancel={cancelRequest} />}
        {review && draft && (
          <fieldset data-guide="ai-builder-blueprint" disabled={isSaving || isAdjusting || Boolean(pending)} inert={isSaving || isAdjusting || Boolean(pending)}>
            <CreationMetadata draft={draft} prompt={prompt} modelInfo={modelInfo} modelError={modelError} onChange={updateDraft} onDescribe={() => setDescribeAgain(true)} />
            <FieldBuilder draft={draft} onChange={updateDraft} highlights={highlights} />
          </fieldset>
        )}
      </main>
      {review && draft && (
        <footer className="ac-footer" aria-label="設計案の操作">
          <div className="ac-footer-inner">
            <form className="ac-adjustment" onSubmit={(event) => { event.preventDefault(); void generate("adjust"); }}>
              <Icon name="auto_awesome" size="sm" />
              <input
                aria-label="AIで調整"
                maxLength={1000}
                value={instruction}
                disabled={busy || Boolean(pending)}
                placeholder="AIで調整（例：SLAステータスを追加、入荷日を必須に）"
                onChange={(event) => setInstruction(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault(); void generate("adjust");
                  }
                }}
              />
              {isAdjusting
                ? <button className="ac-adjust-submit" type="button" onClick={cancelRequest}>調整をやめる</button>
                : <button className="ac-adjust-submit" type="submit" disabled={!instruction.trim() || busy || Boolean(pending)}><Icon name="send" size="sm" />差分を確認</button>}
            </form>
            <button className="ac-button" type="button" disabled={busy || Boolean(pending)} onClick={regenerate}><Icon name="refresh" size="sm" />AIで再生成</button>
            <button className="ac-button ac-primary" type="button" disabled={busy || Boolean(pending) || errors.length > 0} onClick={() => void save()}><Icon name="draft" size="sm" />{isSaving ? "作成中…" : "下書きとして作成"}</button>
            {errors.length > 0 && <p className="ac-save-status" role="status">作成できない理由：{errors[0]}</p>}
          </div>
        </footer>
      )}
      {replacement && (
        <CreationDialog title="説明を置き換えますか？" onClose={() => setReplacement(null)}>
          <p>入力済みの説明を、この入力例で置き換えます。生成は始まりません。</p>
          <div className="ac-buttons">
            <button type="button" className="ac-button" onClick={() => setReplacement(null)}>戻る</button>
            <button type="button" className="ac-button ac-primary" onClick={() => { setPrompt(replacement); setReplacement(null); requestAnimationFrame(() => promptInput.current?.focus()); }}>置き換える</button>
          </div>
        </CreationDialog>
      )}
      {confirmRegenerate && (
        <CreationDialog title="編集内容を残して再生成しますか？" onClose={() => setConfirmRegenerate(false)}>
          <p>編集を残す場合、手で変更した項目・追加した項目・現在の配置を維持します。全体を作り直すと現在の編集内容は失われます。</p>
          <div className="ac-buttons">
            <button type="button" className="ac-button" onClick={() => void generate("replace")}>全体を作り直す</button>
            <button type="button" className="ac-button ac-primary" onClick={() => void generate("preserve")}>編集を残して再生成</button>
          </div>
        </CreationDialog>
      )}
      {confirmCancel && (
        <CreationDialog title="作成をキャンセルしますか？" onClose={() => setConfirmCancel(false)}>
          <p>未保存の説明・設計案・編集内容は破棄されます。</p>
          <div className="ac-buttons">
            <button type="button" className="ac-button" onClick={() => setConfirmCancel(false)}>編集を続ける</button>
            <button type="button" className="ac-button ac-danger-button" onClick={() => { cancelRequest(); router.push("/apps"); }}>作成をキャンセル</button>
          </div>
        </CreationDialog>
      )}
      {pending && (
        <CreationDialog title="AIによる調整の差分" onClose={() => setPending(null)}>
          <p className="ac-caption">現在の設計案はまだ変更していません。内容を確認してから適用できます。</p>
          {changes.length ? <ul className="ac-diff-list">{changes.map((change, index) => (
            <li key={index} className={change.kind === "追加" ? "ac-diff-added" : change.kind === "削除" ? "ac-diff-removed" : "ac-diff-changed"}><strong>{change.kind}：{change.name}</strong><p>{change.detail}</p></li>
          ))}</ul> : <p>変更はありません。</p>}
          <div className="ac-buttons">
            <button type="button" className="ac-button" onClick={() => setPending(null)}>破棄</button>
            <button type="button" className="ac-button ac-primary" disabled={!changes.length} onClick={applyAdjustment}>適用する</button>
          </div>
        </CreationDialog>
      )}
    </div>
  );
}

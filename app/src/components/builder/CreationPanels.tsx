"use client";

import Link from "next/link";
import type { RefObject } from "react";
import { Icon } from "@/components/shared/Icon";
import { automaticCode, draftCodeError, type AppDraft } from "@/lib/app-creation";
import type { BlueprintModelInfo } from "@/types/ai";

const EXAMPLES = [
  { title: "在庫管理", summary: "品目・在庫数・保管場所・発注点", text: "倉庫の在庫を管理したい。品目ごとに在庫数・保管場所・発注点・入荷日を記録し、担当者が一覧やカレンダーで確認できるアプリ。" },
  { title: "問い合わせ管理", summary: "受付日・担当・SLA期限・状態", text: "顧客からの問い合わせを管理したい。件名・受付日・担当者・SLA期限・対応状況を記録し、サポートチームが状況別に確認できるアプリ。" },
  { title: "備品の貸出", summary: "備品・借りた人・返却予定日", text: "社内の備品貸出を管理したい。備品名・利用者・貸出日・返却予定日・返却済みかを記録し、総務が一覧で確認できるアプリ。" },
  { title: "案件・商談", summary: "顧客・金額・確度・受注予定日", text: "営業案件を管理したい。案件名・顧客名・担当者・見込み金額・商談ステージ・受注予定日を記録し、営業チームがカンバンや集計で確認できるアプリ。" },
  { title: "日報", summary: "日付・作業内容・所要時間", text: "チームの作業日報を記録したい。日付・担当者・作業内容・所要時間を管理し、チームリーダーが一覧や集計で振り返るアプリ。" },
];

export function CreationSteps({ step }: { step: number }) {
  return (
    <ol className="ac-steps" aria-label="アプリ作成の手順">
      {["説明する", "設計を確認・編集", "下書きとして作成"].map((label, index) => (
        <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={step > index + 1 ? "is-done" : ""}>
          <span className="ac-step-number">{step > index + 1 ? <Icon name="check" size="sm" /> : index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

export function CreationModelSummary({ info, error }: { info: BlueprintModelInfo | null; error: string }) {
  return (
    <div className="ac-model">
      <span className="ac-model-icon"><Icon name="memory" size="sm" /></span>
      <span>使用モデル： <strong>{info?.model ?? "確認中…"}</strong></span>
      <span className="ac-model-source">
        {info ? info.source === "template" ? `（Prompt Template「${info.templateName ?? "有効なテンプレート"}」の指定）` : "（管理画面の既定モデル）" : error || "サーバーに確認中…"}
      </span>
      <Link className="ac-link" href="/admin/openai">管理画面で変更</Link>
    </div>
  );
}

interface CreationDescribeProps {
  prompt: string;
  promptInput: RefObject<HTMLTextAreaElement | null>;
  ready: boolean;
  modelInfo: BlueprintModelInfo | null;
  modelError: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  onExample: (value: string) => void;
  onReview?: () => void;
}

export function CreationDescribe({ prompt, promptInput, ready, modelInfo, modelError, onPromptChange, onGenerate, onExample, onReview }: CreationDescribeProps) {
  return (
    <div className="ac-description-layout">
      <form className="ac-panel ac-prompt-panel" onSubmit={(event) => { event.preventDefault(); onGenerate(); }}>
        <div className="ac-control" data-guide="ai-builder-prompt">
          <label htmlFor="creation-prompt">作りたいアプリの説明</label>
          <textarea
            ref={promptInput}
            id="creation-prompt"
            className="ac-description-input"
            aria-describedby="creation-prompt-hints creation-prompt-count"
            disabled={!ready}
            maxLength={1000}
            value={prompt}
            placeholder="例：倉庫の在庫を管理したい。品目ごとに在庫数・保管場所・発注点を持ち、発注点を下回った品目を一覧で確認したい。"
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault(); onGenerate();
              }
            }}
          />
        </div>
        <div className="ac-prompt-assistance">
          <ul className="ac-hints" id="creation-prompt-hints" aria-label="書き方のヒント">
            <li><Icon name="check" size="sm" /><span title="何を記録・管理しますか？">扱う情報</span></li>
            <li><Icon name="check" size="sm" /><span title="誰が入力・確認しますか？">使う人</span></li>
            <li><Icon name="check" size="sm" /><span title="一覧・カンバン・カレンダー・集計など">見たい形（一覧・カレンダー・集計）</span></li>
          </ul>
          <p className="ac-caption ac-counter" id="creation-prompt-count" aria-live="polite">{prompt.length} / 1000文字</p>
        </div>
        <p className="ac-info"><Icon name="info" size="sm" /><span>作成されるのは <strong>1アプリ・1テーブル</strong>、フィールドは <strong>1〜10個</strong> です。作成後は下書きとして保存され、サンプルレコード3件が入ります。</span></p>
        <div className="ac-prompt-bottom">
          <CreationModelSummary info={modelInfo} error={modelError} />
          <div className="ac-generate-actions">
            {!prompt.trim() && <span className="ac-caption">説明を入力してください</span>}
            {onReview && <button type="button" className="ac-button ac-ghost" onClick={onReview}>編集に戻る</button>}
            <button type="submit" className="ac-button ac-primary" aria-label="設計案を生成" disabled={!ready || !prompt.trim()} data-guide="ai-builder-generate">
              <Icon name="auto_awesome" size="sm" />設計案を生成 <kbd aria-hidden="true">⌘ / Ctrl＋Enter</kbd>
            </button>
          </div>
        </div>
      </form>
      <section className="ac-examples" aria-labelledby="creation-examples-heading">
        <div className="ac-examples-heading"><h2 id="creation-examples-heading">入力例から始める</h2><p className="ac-caption">選ぶと入力欄に入ります。すぐには生成しません。</p></div>
        <div className="ac-example-list">
          {EXAMPLES.map((example) => (
            <button type="button" className="ac-example" disabled={!ready} key={example.title} onClick={() => onExample(example.text)}>
              <strong>{example.title}</strong><span className="ac-caption">{example.summary}</span><span className="ac-example-link">入力欄に入れる</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

const GENERATION_STAGES = [
  { name: "アプリ名・コード", active: "用途に合う名前とコードを検討中…", done: "アプリの基本情報を整理中" },
  { name: "テーブル", active: "1つの業務テーブルにまとめています…", done: "1アプリ・1テーブルの構成を検討" },
  { name: "フィールド", active: "1〜10個の項目と配置を設計しています…", done: "項目の型・必須・並び方を検討" },
  { name: "表示とサンプル", active: "ビューとサンプルを確認しています…", done: "表示の構成を確認" },
];

export function CreationProgress({ elapsed, onCancel }: { elapsed: number; onCancel: () => void }) {
  const stage = Math.min(3, Math.floor(elapsed / 6));
  return (
    <section className="ac-panel ac-progress" aria-label="設計案の生成状況" aria-busy="true">
      <div className="ac-progress-stages">
        <h2><span className="ac-progress-icon"><Icon name="auto_awesome" size="sm" /></span>設計案を作成中…</h2>
        <div className="ac-progress-track" aria-hidden="true"><span style={{ width: `${20 + stage * 20}%` }} /></div>
        <ol aria-live="polite">
          {GENERATION_STAGES.map((item, index) => (
            <li key={item.name} className={index < stage ? "is-done" : index === stage ? "is-active" : ""} aria-current={index === stage ? "step" : undefined}>
              <span className="ac-stage-dot" /><div><strong>{item.name}</strong><p className="ac-caption">{index < stage ? item.done : index === stage ? item.active : "待機中"}</p></div>
            </li>
          ))}
        </ol>
        <p className="ac-caption ac-progress-note">段階表示は経過時間に基づく目安です。実際の結果は生成完了後に表示します。</p>
        <button type="button" className="ac-button ac-ghost" onClick={onCancel}>生成をやめる</button>
      </div>
      <div className="ac-progress-preview" aria-label="生成結果のプレビュー" aria-hidden="true">
        <h3>フィールド</h3>
        <div className="ac-skeleton-grid">
          {[0, 1, 2, 3, 4, 5].map((index) => <div className={`ac-skeleton${index === stage ? " is-active" : ""}`} key={index} />)}
        </div>
        <div className="ac-skeleton-line" /><div className="ac-skeleton-line is-short" />
      </div>
    </section>
  );
}

interface CreationMetadataProps {
  draft: AppDraft;
  prompt: string;
  modelInfo: BlueprintModelInfo | null;
  modelError: string;
  onChange: (draft: AppDraft) => void;
  onDescribe: () => void;
}

export function CreationMetadata({ draft, prompt, modelInfo, modelError, onChange, onDescribe }: CreationMetadataProps) {
  const appError = draftCodeError(draft.code);
  const tableError = draftCodeError(draft.table.code);
  return (
    <section className="ac-panel ac-metadata" aria-label="アプリとテーブル">
      <div className="ac-metadata-grid">
        <div className="ac-control"><label htmlFor="creation-app-name">アプリ名</label><input id="creation-app-name" value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value, code: draft.codeAuto ? automaticCode(event.target.value, draft.code, "-") : draft.code })} /></div>
        <div className="ac-control">
          <label htmlFor="creation-app-code">アプリコード</label>
          <div className={`ac-code-input${draft.codeAuto ? " is-auto" : ""}`}><input id="creation-app-code" className="ac-code" value={draft.code} aria-invalid={Boolean(appError)} aria-describedby={appError ? "creation-app-code-error" : undefined} onChange={(event) => onChange({ ...draft, code: event.target.value, codeAuto: false })} /><span><Icon name={draft.codeAuto ? "lock" : "edit"} size="sm" />{draft.codeAuto ? "自動" : "手動"}</span></div>
          {appError && <p className="ac-error" id="creation-app-code-error">{appError}</p>}
        </div>
        <div className="ac-control"><label htmlFor="creation-table-name">テーブル名</label><input id="creation-table-name" value={draft.table.name} onChange={(event) => onChange({ ...draft, table: { ...draft.table, name: event.target.value, code: draft.table.codeAuto ? automaticCode(event.target.value, draft.table.code, "-") : draft.table.code } })} /></div>
        <div className="ac-control">
          <label htmlFor="creation-table-code">テーブルコード</label>
          <div className={`ac-code-input${draft.table.codeAuto ? " is-auto" : ""}`}><input id="creation-table-code" className="ac-code" value={draft.table.code} aria-invalid={Boolean(tableError)} aria-describedby={tableError ? "creation-table-code-error" : undefined} onChange={(event) => onChange({ ...draft, table: { ...draft.table, code: event.target.value, codeAuto: false } })} /><span><Icon name={draft.table.codeAuto ? "lock" : "edit"} size="sm" />{draft.table.codeAuto ? "自動" : "手動"}</span></div>
          {tableError && <p className="ac-error" id="creation-table-code-error">{tableError}</p>}
        </div>
        <button type="button" className="ac-button ac-ghost ac-description-edit" onClick={onDescribe}><Icon name="edit" size="sm" />説明を直す</button>
      </div>
      <p className="ac-caption ac-prompt-summary" title={prompt}>1アプリにつき1テーブルです。 ・ 元の説明：{prompt}</p>
      <div className="ac-metadata-extra">
        <CreationModelSummary info={modelInfo} error={modelError} />
        <details>
          <summary className="ac-caption">アプリの説明とAIの設計説明</summary>
          <div className="ac-control"><label htmlFor="creation-app-description">アプリの説明</label><textarea id="creation-app-description" value={draft.description} rows={2} onChange={(event) => onChange({ ...draft, description: event.target.value })} /></div>
          <p className="ac-ai-reason"><Icon name="auto_awesome" size="sm" />{draft.aiInsight}</p>
        </details>
      </div>
    </section>
  );
}

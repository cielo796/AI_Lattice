"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/shared/Icon";
import { cn } from "@/lib/cn";
import {
  executeRecordAI,
  type RuntimeAIActionType,
  type RuntimeAIExecution,
} from "@/lib/api/records";
import { useToastStore } from "@/stores/toastStore";
import type { AppRecord } from "@/types/record";

export interface FallbackRecommendedAction {
  icon: string;
  label: string;
  description: string;
}

interface RecordAIPanelProps {
  appCode: string;
  tableCode: string;
  record: AppRecord | null;
  fallbackSummary: string;
  fallbackActions: FallbackRecommendedAction[];
  isPostingReply?: boolean;
  onPostReply?: (text: string) => Promise<void>;
}

type AIResults = Partial<Record<RuntimeAIActionType, RuntimeAIExecution>>;

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-error-container text-on-error-container",
  medium: "bg-warning-container text-on-warning-container",
  low: "bg-info-container text-on-info-container",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

function SectionHeading({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
        {label}
      </span>
      {children}
    </div>
  );
}

function AIRunButton({
  label,
  isLoading,
  disabled,
  onClick,
}: {
  label: string;
  isLoading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[10px] font-bold tracking-wide transition-colors",
        "bg-tertiary-container text-on-tertiary-container hover:bg-tertiary/20",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <Icon
        name={isLoading ? "progress_activity" : "auto_awesome"}
        size="sm"
        className={cn("text-[14px]", isLoading && "animate-spin")}
      />
      {isLoading ? "生成中..." : label}
    </button>
  );
}

function AIGeneratedBadge({ modelName }: { modelName: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-container px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-on-tertiary-container">
      <Icon name="auto_awesome" size="sm" className="text-[11px]" filled />
      AI生成 · {modelName}
    </span>
  );
}

export function RecordAIPanel({
  appCode,
  tableCode,
  record,
  fallbackSummary,
  fallbackActions,
  isPostingReply = false,
  onPostReply,
}: RecordAIPanelProps) {
  const pushToast = useToastStore((store) => store.pushToast);
  const [results, setResults] = useState<AIResults>({});
  const [loadingAction, setLoadingAction] = useState<RuntimeAIActionType | null>(
    null
  );
  const recordId = record?.id ?? null;

  useEffect(() => {
    setResults({});
    setLoadingAction(null);
  }, [recordId]);

  async function runAction(action: RuntimeAIActionType) {
    if (!recordId || loadingAction) {
      return;
    }

    try {
      setLoadingAction(action);
      const result = await executeRecordAI(appCode, tableCode, recordId, action);
      setResults((current) => ({ ...current, [action]: result }));
    } catch (error) {
      pushToast({
        title: "AI実行に失敗しました",
        description:
          error instanceof Error ? error.message : "時間をおいて再試行してください。",
        variant: "error",
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function handlePostReply(body: string) {
    if (!onPostReply) {
      return;
    }

    try {
      await onPostReply(body);
      pushToast({
        title: "返信案をコメントに投稿しました",
        variant: "success",
      });
    } catch {
      // 投稿失敗時のトーストは onPostReply 側で表示される。
    }
  }

  async function handleCopyReply(body: string) {
    try {
      await navigator.clipboard.writeText(body);
      pushToast({ title: "返信案をコピーしました", variant: "success" });
    } catch {
      pushToast({
        title: "クリップボードへのコピーに失敗しました",
        variant: "error",
      });
    }
  }

  const summaryResult = results.summarize;
  const actionsResult = results.next_actions;
  const replyResult = results.reply_draft;

  return (
    <div className="space-y-5">
      <section>
        <SectionHeading label="AI要約">
          <AIRunButton
            label="AIで要約"
            isLoading={loadingAction === "summarize"}
            disabled={!recordId || loadingAction !== null}
            onClick={() => void runAction("summarize")}
          />
        </SectionHeading>

        {summaryResult?.summary ? (
          <div className="space-y-2 rounded-lg bg-tertiary-container/40 p-3">
            <p className="text-xs leading-relaxed text-on-surface">
              {summaryResult.summary}
            </p>
            {summaryResult.keyPoints && summaryResult.keyPoints.length > 0 && (
              <ul className="space-y-1">
                {summaryResult.keyPoints.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-1.5 text-[11px] leading-relaxed text-on-surface-variant"
                  >
                    <Icon
                      name="check_circle"
                      size="sm"
                      className="mt-0.5 shrink-0 text-[13px] text-tertiary"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            )}
            <AIGeneratedBadge modelName={summaryResult.modelName} />
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-on-surface-variant">
            {fallbackSummary}
          </p>
        )}
      </section>

      <section>
        <SectionHeading label="推奨アクション">
          <AIRunButton
            label="AIで提案"
            isLoading={loadingAction === "next_actions"}
            disabled={!recordId || loadingAction !== null}
            onClick={() => void runAction("next_actions")}
          />
        </SectionHeading>

        <div className="space-y-2">
          {actionsResult?.nextActions && actionsResult.nextActions.length > 0 ? (
            <>
              {actionsResult.nextActions.map((action) => (
                <div
                  key={action.label}
                  className="flex gap-3 rounded-lg bg-tertiary-container/40 p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tertiary/15">
                    <Icon name="bolt" size="sm" className="text-tertiary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-on-surface">
                        {action.label}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-px text-[9px] font-bold",
                          PRIORITY_STYLES[action.priority] ?? PRIORITY_STYLES.medium
                        )}
                      >
                        {PRIORITY_LABELS[action.priority] ?? "中"}
                      </span>
                    </div>
                    <div className="text-[10px] leading-relaxed text-on-surface-variant">
                      {action.description}
                    </div>
                  </div>
                </div>
              ))}
              <AIGeneratedBadge modelName={actionsResult.modelName} />
            </>
          ) : fallbackActions.length > 0 ? (
            fallbackActions.map((action) => (
              <div
                key={action.label}
                className="flex gap-3 rounded-lg bg-surface-container p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon name={action.icon} size="sm" className="text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-on-surface">
                    {action.label}
                  </div>
                  <div className="text-[10px] text-on-surface-variant">
                    {action.description}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg bg-surface-container p-3 text-xs text-on-surface-variant">
              推奨アクションはまだありません。
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionHeading label="返信案">
          <AIRunButton
            label="返信案を生成"
            isLoading={loadingAction === "reply_draft"}
            disabled={!recordId || loadingAction !== null}
            onClick={() => void runAction("reply_draft")}
          />
        </SectionHeading>

        {replyResult?.replyDraft ? (
          <div className="space-y-2 rounded-lg bg-tertiary-container/40 p-3">
            <div className="text-xs font-bold text-on-surface">
              {replyResult.replyDraft.subject}
            </div>
            <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-on-surface">
              {replyResult.replyDraft.body}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {onPostReply && (
                <button
                  type="button"
                  disabled={isPostingReply}
                  onClick={() =>
                    void handlePostReply(replyResult.replyDraft?.body ?? "")
                  }
                  className="inline-flex h-6 items-center gap-1 rounded-full bg-tertiary px-2.5 text-[10px] font-bold text-white transition-colors hover:bg-tertiary/85 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name="send" size="sm" className="text-[12px]" />
                  コメントに投稿
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  void handleCopyReply(replyResult.replyDraft?.body ?? "")
                }
                className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-container-high px-2.5 text-[10px] font-bold text-on-surface-variant transition-colors hover:bg-surface-container-highest"
              >
                <Icon name="content_copy" size="sm" className="text-[12px]" />
                コピー
              </button>
              <AIGeneratedBadge modelName={replyResult.modelName} />
            </div>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-on-surface-variant">
            {recordId
              ? "依頼者へ送る返信文をAIが起案します。"
              : "レコードを選択すると返信案を生成できます。"}
          </p>
        )}
      </section>
    </div>
  );
}

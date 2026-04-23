"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/shared/Badge";
import { Icon } from "@/components/shared/Icon";
import { Button } from "@/components/shared/Button";
import { RecordCreatePanel } from "@/components/runtime/RecordCreatePanel";
import { cn } from "@/lib/cn";
import {
  createComment,
  createRecord,
  getRuntimeTableMeta,
  listAttachments,
  listComments,
  listRecords,
  uploadAttachment,
} from "@/lib/api/records";
import {
  formatDateTime,
  formatFieldKey,
  formatPriorityLabel,
  formatStatusLabel,
  getDisplayFields,
  getPriorityVariant,
  getRecordCustomer,
  getRecordDescription,
  getRecordIdentifier,
  getRecordPriority,
  getRecordSentiment,
  getRecordTitle,
  getStatusVariant,
} from "@/lib/runtime-records";
import type { AppField, RuntimeTableMeta } from "@/types/app";
import type { AppRecord, Attachment, RecordComment } from "@/types/record";

const tabs = [
  { id: "all", label: "すべて" },
  { id: "open", label: "未対応" },
  { id: "priority", label: "優先度高" },
];

type MobileOverlay = "detail" | "create" | null;

interface MobileRecordDetailViewProps {
  error?: string | null;
  record: AppRecord;
  fieldDefinitions?: AppField[];
  comments: RecordComment[];
  attachments: Attachment[];
  isLoadingActivity?: boolean;
  isSubmittingComment?: boolean;
  isUploadingAttachment?: boolean;
  onBack: () => void;
  onAddComment?: (commentText: string) => Promise<void>;
  onAddAttachment?: (file: File) => Promise<void>;
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatFieldValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function MobileRecordDetailView({
  error,
  record,
  fieldDefinitions = [],
  comments,
  attachments,
  isLoadingActivity = false,
  isSubmittingComment = false,
  isUploadingAttachment = false,
  onBack,
  onAddComment,
  onAddAttachment,
}: MobileRecordDetailViewProps) {
  const [commentText, setCommentText] = useState("");
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const description = getRecordDescription(record);
  const customer = getRecordCustomer(record) || "依頼者不明";
  const fields = getDisplayFields(record);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextComment = commentText.trim();
    if (!nextComment || !onAddComment) {
      return;
    }

    await onAddComment(nextComment);
    setCommentText("");
  }

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !onAddAttachment) {
      return;
    }

    await onAddAttachment(file);
    event.target.value = "";
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-surface">
      <header className="border-b border-outline-variant/20 bg-surface px-4 pb-4 pt-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface"
          >
            <Icon name="arrow_back" size="md" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={getStatusVariant(record.status)}>
                {formatStatusLabel(record.status)}
              </Badge>
              <span className="text-[10px] font-mono text-on-surface-variant">
                {getRecordIdentifier(record)}
              </span>
            </div>
            <h1 className="text-lg font-bold leading-tight text-on-surface">
              {getRecordTitle(record)}
            </h1>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4">
        <div className="mb-4 rounded-2xl bg-surface-container p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-on-surface">{customer}</span>
            <span className="text-[10px] text-on-surface-variant">
              {formatDateTime(record.createdAt)}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-on-surface">
            {description || "説明はありません"}
          </p>
        </div>

        {fields.length > 0 && (
          <div className="mb-5">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              レコードデータ
            </div>
            <div className="space-y-2">
              {fields.map(([key, value]) => (
                <div key={key} className="rounded-xl bg-surface-container p-4">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {formatFieldKey(key, fieldDefinitions)}
                  </div>
                  <div className="text-sm text-on-surface">
                    {formatFieldValue(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              添付ファイル
            </div>
            {isUploadingAttachment && (
              <div className="text-[10px] text-on-surface-variant">
                アップロード中...
              </div>
            )}
          </div>
          {isLoadingActivity && attachments.length === 0 ? (
            <div className="rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">
              添付ファイルを読み込んでいます...
            </div>
          ) : attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.storagePath}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl bg-surface-container p-4"
                >
                  <div className="mb-1 text-sm font-bold text-on-surface">
                    {attachment.fileName}
                  </div>
                  <div className="text-[11px] text-on-surface-variant">
                    {(attachment.fileSize / 1024).toFixed(1)} KB / {attachment.mimeType}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
              添付ファイルはまだありません。
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            コメント
          </div>
          {isLoadingActivity && comments.length === 0 ? (
            <div className="rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">
              コメントを読み込んでいます...
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-2">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-xl bg-surface-container p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {comment.isSystem && <Badge variant="info">システム</Badge>}
                      <span className="text-xs font-bold text-on-surface">
                        {comment.isSystem ? "システムイベント" : comment.createdBy}
                      </span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant">
                      {formatDateTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-on-surface">
                    {comment.commentText}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
              コメントはまだありません。
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-outline-variant/20 bg-surface px-4 pb-6 pt-3">
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
          <input
            ref={attachmentInputRef}
            type="file"
            className="hidden"
            onChange={(event) => void handleAttachmentChange(event)}
          />
          <textarea
            rows={3}
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder="コメントを追加..."
            className="w-full rounded-2xl bg-surface-container px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              disabled={!onAddAttachment || isUploadingAttachment}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="添付ファイルを追加"
            >
              <Icon name="attach_file" size="sm" />
            </button>
            <Button
              type="submit"
              size="sm"
              disabled={!commentText.trim() || isSubmittingComment || !onAddComment}
            >
              {isSubmittingComment ? "送信中..." : "送信"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MobileRuntimePage() {
  const params = useParams<{ appCode: string; table: string }>();
  const appCode = getParam(params.appCode);
  const tableCode = getParam(params.table);

  const [activeTab, setActiveTab] = useState("all");
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<AppRecord[]>([]);
  const [tableMeta, setTableMeta] = useState<RuntimeTableMeta | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comments, setComments] = useState<RecordComment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState<MobileOverlay>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedRecord =
    records.find((record) => record.id === selectedId) ?? null;

  useEffect(() => {
    if (!appCode || !tableCode) {
      setError("実行画面のルートパラメータが見つかりません。");
      setIsLoadingRecords(false);
      setIsLoadingMeta(false);
      return;
    }

    let cancelled = false;

    async function loadRuntimeRecords() {
      try {
        setIsLoadingRecords(true);
        const nextRecords = await listRecords(appCode, tableCode);

        if (cancelled) {
          return;
        }

        setRecords(nextRecords);
        setError(null);
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setRecords([]);
        setError(
          nextError instanceof Error
            ? nextError.message
            : "レコードの読み込みに失敗しました。"
        );
      } finally {
        if (!cancelled) {
          setIsLoadingRecords(false);
        }
      }
    }

    void loadRuntimeRecords();

    return () => {
      cancelled = true;
    };
  }, [appCode, tableCode]);

  useEffect(() => {
    if (!appCode || !tableCode) {
      return;
    }

    let cancelled = false;

    async function loadRuntimeMeta() {
      try {
        setIsLoadingMeta(true);
        const nextMeta = await getRuntimeTableMeta(appCode, tableCode);

        if (cancelled) {
          return;
        }

        setTableMeta(nextMeta);
        setError(null);
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setTableMeta(null);
        setError(
          nextError instanceof Error
            ? nextError.message
            : "スキーマの読み込みに失敗しました。"
        );
      } finally {
        if (!cancelled) {
          setIsLoadingMeta(false);
        }
      }
    }

    void loadRuntimeMeta();

    return () => {
      cancelled = true;
    };
  }, [appCode, tableCode]);

  useEffect(() => {
    if (!appCode || !tableCode || !selectedId || activeOverlay !== "detail") {
      setComments([]);
      setAttachments([]);
      return;
    }

    const currentRecordId = selectedId;
    let cancelled = false;

    async function loadRecordActivity() {
      try {
        setIsLoadingActivity(true);
        const [nextComments, nextAttachments] = await Promise.all([
          listComments(appCode, tableCode, currentRecordId),
          listAttachments(appCode, tableCode, currentRecordId),
        ]);

        if (cancelled) {
          return;
        }

        setComments(nextComments);
        setAttachments(nextAttachments);
        setError(null);
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setComments([]);
        setAttachments([]);
        setError(
          nextError instanceof Error
            ? nextError.message
            : "レコード活動の読み込みに失敗しました。"
        );
      } finally {
        if (!cancelled) {
          setIsLoadingActivity(false);
        }
      }
    }

    void loadRecordActivity();

    return () => {
      cancelled = true;
    };
  }, [activeOverlay, appCode, selectedId, tableCode]);

  function openDetail(recordId: string) {
    setSelectedId(recordId);
    setActiveOverlay("detail");
  }

  async function handleCreateRecord(input: {
    status: string;
    data: Record<string, unknown>;
  }) {
    if (!appCode || !tableCode) {
      return;
    }

    try {
      setIsSavingRecord(true);
      const record = await createRecord(appCode, tableCode, input);
      setRecords((current) => [record, ...current]);
      setSelectedId(record.id);
      setComments([]);
      setAttachments([]);
      setActiveOverlay("detail");
      setError(null);
    } catch (nextError) {
      throw (
        nextError instanceof Error
          ? nextError
          : new Error("レコードの作成に失敗しました。")
      );
    } finally {
      setIsSavingRecord(false);
    }
  }

  async function handleAddComment(commentText: string) {
    if (!appCode || !tableCode || !selectedId) {
      return;
    }

    try {
      setIsSubmittingComment(true);
      const comment = await createComment(appCode, tableCode, selectedId, {
        commentText,
      });
      setComments((current) => [...current, comment]);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "コメントの追加に失敗しました。"
      );
    } finally {
      setIsSubmittingComment(false);
    }
  }

  async function handleAddAttachment(file: File) {
    if (!appCode || !tableCode || !selectedId) {
      return;
    }

    try {
      setIsUploadingAttachment(true);
      const attachment = await uploadAttachment(appCode, tableCode, selectedId, file);
      setAttachments((current) => [attachment, ...current]);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "添付ファイルの追加に失敗しました。"
      );
    } finally {
      setIsUploadingAttachment(false);
    }
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRecords = records.filter((record) => {
    if (activeTab === "open" && !record.status.toLowerCase().includes("open")) {
      return false;
    }

    if (activeTab === "priority") {
      const priority = getRecordPriority(record);
      const variant = priority ? getPriorityVariant(priority) : "default";
      if (variant !== "error" && variant !== "warning") {
        return false;
      }
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      getRecordIdentifier(record),
      getRecordTitle(record),
      getRecordDescription(record),
      getRecordPriority(record),
      record.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="glass-effect sticky top-0 z-20 px-4 pb-4 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-primary">
              モバイル実行画面
            </div>
            <h1 className="font-headline text-base font-extrabold tracking-tight text-white">
              {tableMeta?.table.name || "実行画面"}
            </h1>
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
            <Icon name="notifications" size="md" />
          </button>
        </div>
        <div className="relative">
          <Icon
            name="search"
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="レコードを検索..."
            className="w-full rounded-full bg-surface-container py-2.5 pl-9 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </header>

      <div className="overflow-x-auto border-b border-outline-variant/20 px-4 py-3">
        <div className="flex min-w-max gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-1.5 text-[10px] font-bold tracking-wider transition-colors",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "bg-surface-container text-on-surface-variant"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {error && activeOverlay === null && (
          <div className="mb-3 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {(isLoadingRecords || isLoadingMeta) && (
          <div className="rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">
            レコードを読み込んでいます...
          </div>
        )}

        {!isLoadingRecords && filteredRecords.length === 0 && (
          <div className="rounded-xl border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
            レコードが見つかりません。
          </div>
        )}

        <div className="space-y-3">
          {filteredRecords.map((record) => {
            const priority = getRecordPriority(record);
            const sentiment = getRecordSentiment(record);

            return (
              <button
                key={record.id}
                type="button"
                onClick={() => openDetail(record.id)}
                className="block w-full rounded-xl bg-surface-container p-4 text-left"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    {getRecordIdentifier(record)}
                  </span>
                  <div className="flex items-center gap-2">
                    {typeof sentiment === "number" && sentiment < -0.5 && (
                      <Badge variant="ai">要確認</Badge>
                    )}
                    {priority && (
                      <Badge variant={getPriorityVariant(priority)}>
                        {formatPriorityLabel(priority)}
                      </Badge>
                    )}
                  </div>
                </div>

                <h3 className="mb-1.5 text-sm font-bold leading-snug text-on-surface">
                  {getRecordTitle(record)}
                </h3>

                <p className="mb-3 line-clamp-2 text-xs text-on-surface-variant">
                  {getRecordDescription(record) || "説明はありません"}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-on-surface-variant">
                    {formatStatusLabel(record.status)}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-primary">
                    <Icon name="visibility" size="sm" />
                    開く
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <nav className="glass-effect fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around py-3">
        {[
          { icon: "home", label: "ホーム" },
          { icon: "apps", label: "アプリ" },
          { icon: "task", label: "レコード", active: true },
          { icon: "search", label: "検索" },
        ].map((item) => (
          <button
            key={item.label}
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-1",
              item.active ? "text-primary" : "text-on-surface-variant"
            )}
          >
            <Icon name={item.icon} size="md" />
            <span className="text-[9px] font-bold tracking-wider">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setActiveOverlay("create")}
        disabled={isLoadingMeta}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-2xl disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon name="add" size="lg" className="text-white" />
      </button>

      {activeOverlay === "detail" && selectedRecord && (
        <MobileRecordDetailView
          error={error}
          record={selectedRecord}
          fieldDefinitions={tableMeta?.fields}
          comments={comments}
          attachments={attachments}
          isLoadingActivity={isLoadingActivity}
          isSubmittingComment={isSubmittingComment}
          isUploadingAttachment={isUploadingAttachment}
          onBack={() => setActiveOverlay(null)}
          onAddComment={handleAddComment}
          onAddAttachment={handleAddAttachment}
        />
      )}

      {activeOverlay === "create" && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-surface pb-24 pt-4">
          {error && (
            <div className="mx-4 mb-3 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}
          <RecordCreatePanel
            key={`mobile-create-${tableMeta?.table.id ?? tableCode}`}
            fields={tableMeta?.fields ?? []}
            tableName={tableMeta?.table.name}
            isSubmitting={isSavingRecord}
            onClose={() => setActiveOverlay(null)}
            onSubmit={handleCreateRecord}
          />
        </div>
      )}
    </div>
  );
}

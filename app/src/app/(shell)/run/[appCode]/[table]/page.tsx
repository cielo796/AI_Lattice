"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AISidebar } from "@/components/ai/AISidebar";
import { RecordCreatePanel } from "@/components/runtime/RecordCreatePanel";
import { RecordDetail } from "@/components/runtime/RecordDetail";
import { RecordList } from "@/components/runtime/RecordList";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { TopBar } from "@/components/shared/TopBar";
import {
  createComment,
  createRecord,
  deleteAttachment,
  deleteRecord,
  getRuntimeTableMeta,
  listAttachments,
  listBackReferences,
  listComments,
  listRecordApprovals,
  listRecords,
  updateRecord,
  uploadAttachment,
} from "@/lib/api/records";
import {
  formatRelativeTime,
  formatPriorityLabel,
  formatStatusLabel,
  getReferenceDisplayFieldCode,
  getReferenceRecordLabel,
  getReferenceTableCode,
  getPriorityVariant,
  getRecordCustomer,
  getRecordDescription,
  getRecordPriority,
  getRecordSentiment,
  getRecordTitle,
  type ReferenceFieldsByField,
  resolveRecordListReferences,
  type ReferenceRecordsByField,
} from "@/lib/runtime-records";
import { useToastStore } from "@/stores/toastStore";
import type { ReferenceLabelsByField } from "@/lib/runtime-records";
import type { RuntimeTableMeta } from "@/types/app";
import type {
  AppRecord,
  Approval,
  Attachment,
  RecordBackReferenceGroup,
  RecordComment,
} from "@/types/record";

type RecommendedAction = {
  icon: string;
  label: string;
  description: string;
};

type RecordPanelMode = "create" | "edit" | null;

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildSummary(record: AppRecord | null) {
  if (!record) {
    return "レコードを選択すると、最新の活動内容を確認できます。";
  }

  const priority = getRecordPriority(record);
  const customer = getRecordCustomer(record);
  const description = getRecordDescription(record);

  return [
    `${getRecordTitle(record)} は現在「${formatStatusLabel(record.status)}」です。`,
    priority ? `優先度は「${formatPriorityLabel(priority)}」です。` : null,
    customer ? `依頼者は ${customer} です。` : null,
    description ? `最新の内容: ${description}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildRecommendedActions(record: AppRecord | null): RecommendedAction[] {
  if (!record) {
    return [];
  }

  const actions: RecommendedAction[] = [
    {
      icon: "visibility",
      label: "詳細を確認",
      description: "更新前にコメントと添付ファイルを確認します。",
    },
  ];

  const priority = getRecordPriority(record);
  if (priority && getPriorityVariant(priority) === "error") {
    actions.unshift({
      icon: "priority_high",
      label: "すぐにエスカレーション",
      description: "重要インシデントはオンコール担当へ連携してください。",
    });
  }

  if (record.status.toLowerCase().includes("waiting")) {
    actions.push({
      icon: "mail",
      label: "フォローアップ",
      description: "待機中のレコードです。進行のために更新を送信してください。",
    });
  }

  const sentiment = getRecordSentiment(record);
  if (typeof sentiment === "number" && sentiment < -0.5) {
    actions.push({
      icon: "sentiment_dissatisfied",
      label: "顧客リスク",
      description: "ネガティブな感情があるため、先回りした返信が有効です。",
    });
  }

  return actions.slice(0, 3);
}

function buildSimilarRecords(records: AppRecord[], selected: AppRecord | null) {
  if (!selected) {
    return [];
  }

  const selectedPriority = getRecordPriority(selected);
  const selectedCustomer = getRecordCustomer(selected);

  return records
    .filter((record) => record.id !== selected.id)
    .filter(
      (record) =>
        getRecordPriority(record) === selectedPriority ||
        getRecordCustomer(record) === selectedCustomer
    )
    .slice(0, 3);
}

export default function RuntimeViewPage() {
  const params = useParams<{ appCode: string; table: string }>();
  const searchParams = useSearchParams();
  const appCode = getParam(params.appCode);
  const tableCode = getParam(params.table);
  const requestedRecordId = searchParams.get("recordId")?.trim() ?? "";
  const pushToast = useToastStore((store) => store.pushToast);

  const [records, setRecords] = useState<AppRecord[]>([]);
  const [comments, setComments] = useState<RecordComment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tableMeta, setTableMeta] = useState<RuntimeTableMeta | null>(null);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [recordPanelMode, setRecordPanelMode] = useState<RecordPanelMode>(null);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(
    null
  );
  const [referenceLabelsByField, setReferenceLabelsByField] =
    useState<ReferenceLabelsByField>({});
  const [referenceRecordsByField, setReferenceRecordsByField] =
    useState<ReferenceRecordsByField>({});
  const [referenceFieldsByField, setReferenceFieldsByField] =
    useState<ReferenceFieldsByField>({});
  const [backReferenceGroups, setBackReferenceGroups] = useState<
    RecordBackReferenceGroup[]
  >([]);
  const [isLoadingBackReferences, setIsLoadingBackReferences] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedRecord =
    records.find((record) => record.id === selectedId) ?? null;
  const resolvedRecords = resolveRecordListReferences(
    records,
    tableMeta?.fields ?? [],
    referenceLabelsByField
  );
  const resolvedSelectedRecord =
    resolvedRecords.find((record) => record.id === selectedId) ?? null;

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
        setSelectedId((current) => {
          if (
            requestedRecordId &&
            nextRecords.some((record) => record.id === requestedRecordId)
          ) {
            return requestedRecordId;
          }

          if (current && nextRecords.some((record) => record.id === current)) {
            return current;
          }

          return nextRecords[0]?.id ?? null;
        });
        setError(null);
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setRecords([]);
        setSelectedId(null);
        setComments([]);
        setAttachments([]);
        setApprovals([]);
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
  }, [appCode, refreshKey, requestedRecordId, tableCode]);

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
  }, [appCode, refreshKey, requestedRecordId, tableCode]);

  useEffect(() => {
    if (!appCode || !tableMeta) {
      setReferenceLabelsByField({});
      setReferenceRecordsByField({});
      setReferenceFieldsByField({});
      return;
    }

    const currentTableMeta = tableMeta;
    let cancelled = false;

    async function loadReferenceLabels() {
      const referenceFields = currentTableMeta.fields
        .filter((field) => field.fieldType === "master_ref")
        .map((field) => ({
          fieldCode: field.code,
          tableCode: getReferenceTableCode(field),
          displayFieldCode: getReferenceDisplayFieldCode(field),
        }))
        .filter(
          (field): field is {
            fieldCode: string;
            tableCode: string;
            displayFieldCode: string;
          } =>
            Boolean(field.tableCode)
        );

      if (referenceFields.length === 0) {
        setReferenceLabelsByField({});
        setReferenceRecordsByField({});
        setReferenceFieldsByField({});
        return;
      }

      try {
        const uniqueTableCodes = [
          ...new Set(referenceFields.map((field) => field.tableCode)),
        ];
        const [recordsByTableCode, metaByTableCode] = await Promise.all([
          Object.fromEntries(
            await Promise.all(
              uniqueTableCodes.map(async (referenceTableCode) => [
                referenceTableCode,
                await listRecords(appCode, referenceTableCode),
              ])
            )
          ) as Record<string, AppRecord[]>,
          Object.fromEntries(
            await Promise.all(
              uniqueTableCodes.map(async (referenceTableCode) => [
                referenceTableCode,
                await getRuntimeTableMeta(appCode, referenceTableCode),
              ])
            )
          ) as Record<string, RuntimeTableMeta>,
        ]);

        if (cancelled) {
          return;
        }

        const nextReferenceLabels: ReferenceLabelsByField = {};
        const nextReferenceRecords: ReferenceRecordsByField = {};
        const nextReferenceFields: ReferenceFieldsByField = {};
        for (const referenceField of referenceFields) {
          const records = recordsByTableCode[referenceField.tableCode] ?? [];
          nextReferenceLabels[referenceField.fieldCode] = Object.fromEntries(
            records.map((record) => [
              record.id,
              getReferenceRecordLabel(record, referenceField.displayFieldCode),
            ])
          );
          nextReferenceRecords[referenceField.fieldCode] = Object.fromEntries(
            records.map((record) => [record.id, record])
          );
          nextReferenceFields[referenceField.fieldCode] =
            metaByTableCode[referenceField.tableCode]?.fields ?? [];
        }

        setReferenceLabelsByField(nextReferenceLabels);
        setReferenceRecordsByField(nextReferenceRecords);
        setReferenceFieldsByField(nextReferenceFields);
      } catch {
        if (!cancelled) {
          setReferenceLabelsByField({});
          setReferenceRecordsByField({});
          setReferenceFieldsByField({});
        }
      }
    }

    void loadReferenceLabels();

    return () => {
      cancelled = true;
    };
  }, [appCode, refreshKey, tableMeta]);

  useEffect(() => {
    if (!appCode || !tableCode || !selectedId) {
      setBackReferenceGroups([]);
      setIsLoadingBackReferences(false);
      return;
    }

    const currentRecordId = selectedId;
    let cancelled = false;

    async function loadBackReferences() {
      try {
        setIsLoadingBackReferences(true);
        const nextGroups = await listBackReferences(appCode, tableCode, currentRecordId);

        if (cancelled) {
          return;
        }

        setBackReferenceGroups(nextGroups);
      } catch {
        if (!cancelled) {
          setBackReferenceGroups([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingBackReferences(false);
        }
      }
    }

    void loadBackReferences();
    return () => {
      cancelled = true;
    };
  }, [appCode, refreshKey, selectedId, tableCode]);

  useEffect(() => {
    if (!appCode || !tableCode || !selectedId) {
      setComments([]);
      setAttachments([]);
      setApprovals([]);
      return;
    }

    const currentRecordId = selectedId;
    let cancelled = false;

    async function loadRecordActivity() {
      try {
        setIsLoadingActivity(true);
        const [nextComments, nextAttachments, nextApprovals] = await Promise.all([
          listComments(appCode, tableCode, currentRecordId),
          listAttachments(appCode, tableCode, currentRecordId),
          listRecordApprovals(appCode, tableCode, currentRecordId),
        ]);

        if (cancelled) {
          return;
        }

        setComments(nextComments);
        setAttachments(nextAttachments);
        setApprovals(nextApprovals);
        setError(null);
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setComments([]);
        setAttachments([]);
        setApprovals([]);
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
  }, [appCode, refreshKey, selectedId, tableCode]);

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
      pushToast({ title: "コメントを追加しました", variant: "success" });
    } catch (nextError) {
      const errorMessage =
        nextError instanceof Error
          ? nextError.message
          : "コメントの追加に失敗しました。";
      setError(errorMessage);
      pushToast({
        title: "コメントの追加に失敗しました",
        description: errorMessage,
        variant: "error",
      });
    } finally {
      setIsSubmittingComment(false);
    }
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
      setApprovals([]);
      setRecordPanelMode(null);
      setRefreshKey((current) => current + 1);
      setError(null);
      pushToast({ title: "レコードを作成しました", variant: "success" });
    } catch (nextError) {
      const error =
        nextError instanceof Error
          ? nextError
          : new Error("レコードの作成に失敗しました。");
      pushToast({
        title: "レコードの作成に失敗しました",
        description: error.message,
        variant: "error",
      });
      throw error;
    } finally {
      setIsSavingRecord(false);
    }
  }

  async function handleUpdateRecord(input: {
    status: string;
    data: Record<string, unknown>;
  }) {
    if (!appCode || !tableCode || !selectedRecord) {
      return;
    }

    try {
      setIsSavingRecord(true);
      const record = await updateRecord(appCode, tableCode, selectedRecord.id, input);
      setRecords((current) =>
        current.map((currentRecord) =>
          currentRecord.id === record.id ? record : currentRecord
        )
      );
      setRecordPanelMode(null);
      setRefreshKey((current) => current + 1);
      setError(null);
      pushToast({ title: "レコードを更新しました", variant: "success" });
    } catch (nextError) {
      const error =
        nextError instanceof Error
          ? nextError
          : new Error("レコードの更新に失敗しました。");
      pushToast({
        title: "レコードの更新に失敗しました",
        description: error.message,
        variant: "error",
      });
      throw error;
    } finally {
      setIsSavingRecord(false);
    }
  }

  async function handleDeleteRecord() {
    if (!appCode || !tableCode || !selectedRecord) {
      return;
    }

    const confirmed = window.confirm(
      `「${getRecordTitle(selectedRecord)}」を削除しますか？このレコードは一覧から削除されます。`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeletingRecord(true);
      await deleteRecord(appCode, tableCode, selectedRecord.id);

      const nextRecords = records.filter((record) => record.id !== selectedRecord.id);
      setRecords(nextRecords);
      setSelectedId(nextRecords[0]?.id ?? null);
      setComments([]);
      setAttachments([]);
      setApprovals([]);
      setRecordPanelMode(null);
      setError(null);
      pushToast({ title: "レコードを削除しました", variant: "success" });
    } catch (nextError) {
      const errorMessage =
        nextError instanceof Error
          ? nextError.message
          : "レコードの削除に失敗しました。";
      setError(errorMessage);
      pushToast({
        title: "レコードの削除に失敗しました",
        description: errorMessage,
        variant: "error",
      });
    } finally {
      setIsDeletingRecord(false);
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
      pushToast({ title: "添付ファイルを追加しました", variant: "success" });
    } catch (nextError) {
      const errorMessage =
        nextError instanceof Error
          ? nextError.message
          : "添付ファイルの追加に失敗しました。";
      setError(errorMessage);
      pushToast({
        title: "添付ファイルの追加に失敗しました",
        description: errorMessage,
        variant: "error",
      });
    } finally {
      setIsUploadingAttachment(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!appCode || !tableCode || !selectedId) {
      return;
    }

    const attachment = attachments.find(
      (currentAttachment) => currentAttachment.id === attachmentId
    );
    const confirmed = window.confirm(
      `「${attachment?.fileName ?? "この添付ファイル"}」を削除しますか？`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingAttachmentId(attachmentId);
      await deleteAttachment(appCode, tableCode, selectedId, attachmentId);
      setAttachments((current) =>
        current.filter((currentAttachment) => currentAttachment.id !== attachmentId)
      );
      setError(null);
      pushToast({ title: "添付ファイルを削除しました", variant: "success" });
    } catch (nextError) {
      const errorMessage =
        nextError instanceof Error
          ? nextError.message
          : "添付ファイルの削除に失敗しました。";
      setError(errorMessage);
      pushToast({
        title: "添付ファイルの削除に失敗しました",
        description: errorMessage,
        variant: "error",
      });
    } finally {
      setDeletingAttachmentId(null);
    }
  }

  const recommendedActions = buildRecommendedActions(resolvedSelectedRecord);
  const similarRecords = buildSimilarRecords(
    resolvedRecords,
    resolvedSelectedRecord
  );
  const shouldRenderRecordPanel =
    recordPanelMode === "create" ||
    (recordPanelMode === "edit" && selectedRecord !== null);

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "実行画面" },
          { label: tableMeta?.table.name || tableCode || "レコード" },
        ]}
        actions={
          <>
            <Button
              variant="ghost"
              size="md"
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              <Icon name="sync" size="sm" />
              更新
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setRecordPanelMode("create")}
              disabled={isLoadingMeta}
            >
              <Icon name="add" size="sm" />
              {isLoadingMeta ? "スキーマを読み込み中..." : "新規レコード"}
            </Button>
          </>
        }
      />

      <main className="flex min-h-[calc(100vh-4rem)] flex-col pt-16 2xl:h-[calc(100vh-4rem)] 2xl:flex-row">
        <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
          <RecordList
            records={resolvedRecords}
            selectedId={selectedId ?? undefined}
            isLoading={isLoadingRecords}
            onSelect={(record) => setSelectedId(record.id)}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            {error && (
              <div className="border-b border-error/20 bg-error/10 px-4 py-3 text-sm text-error md:px-8">
                {error}
              </div>
            )}

            {shouldRenderRecordPanel && (
              <RecordCreatePanel
                key={
                  recordPanelMode === "edit"
                    ? `edit-${selectedRecord?.id ?? "none"}`
                    : "create"
                }
                appCode={appCode}
                fields={tableMeta?.fields ?? []}
                mode={recordPanelMode ?? "create"}
                initialRecord={recordPanelMode === "edit" ? selectedRecord : null}
                tableName={tableMeta?.table.name}
                isSubmitting={isSavingRecord}
                onClose={() => setRecordPanelMode(null)}
                onSubmit={
                  recordPanelMode === "edit" ? handleUpdateRecord : handleCreateRecord
                }
              />
            )}

            <RecordDetail
              appCode={appCode}
              runtimeBasePath="/run"
              record={selectedRecord}
              fieldDefinitions={tableMeta?.fields}
              referenceLabelsByField={referenceLabelsByField}
              referenceRecordsByField={referenceRecordsByField}
              referenceFieldsByField={referenceFieldsByField}
              backReferenceGroups={backReferenceGroups}
              isLoadingBackReferences={isLoadingBackReferences}
              comments={comments}
              attachments={attachments}
              approvals={approvals}
              isLoadingActivity={isLoadingActivity}
              isLoadingApprovals={isLoadingActivity}
              isSubmittingComment={isSubmittingComment}
              isUploadingAttachment={isUploadingAttachment}
              isDeletingRecord={isDeletingRecord}
              deletingAttachmentId={deletingAttachmentId}
              onAddComment={handleAddComment}
              onAddAttachment={handleAddAttachment}
              onEditRecord={() => setRecordPanelMode("edit")}
              onDeleteRecord={handleDeleteRecord}
              onDeleteAttachment={handleDeleteAttachment}
            />
          </div>
        </div>

        <AISidebar className="border-t border-outline-variant/20 2xl:h-auto 2xl:w-80 2xl:border-l 2xl:border-t-0">
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">
              実行サマリー
            </div>
            <p className="text-xs leading-relaxed text-on-surface">
              {buildSummary(resolvedSelectedRecord)}
            </p>
          </div>

          <div>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">
              推奨アクション
            </div>
            <div className="space-y-2">
              {recommendedActions.length > 0 ? (
                recommendedActions.map((action) => (
                  <div
                    key={action.label}
                    className="flex gap-3 rounded-lg bg-surface-container p-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon
                        name={action.icon}
                        size="sm"
                        className="text-primary"
                      />
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
          </div>

          <div>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">
              類似レコード
            </div>
            <div className="space-y-2">
              {similarRecords.length > 0 ? (
                similarRecords.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => setSelectedId(record.id)}
                    className="w-full rounded-lg bg-surface-container p-3 text-left transition-colors hover:bg-surface-container-high"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[9px] font-bold uppercase text-primary">
                        {formatRelativeTime(record.updatedAt)}
                      </span>
                      <span className="text-[9px] text-on-surface-variant">
                        {formatStatusLabel(record.status)}
                      </span>
                    </div>
                    <div className="mb-1 line-clamp-2 text-xs font-bold text-on-surface">
                      {getRecordTitle(record)}
                    </div>
                    <div className="line-clamp-2 text-[10px] text-on-surface-variant">
                      {getRecordDescription(record) || "説明はありません"}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-lg bg-surface-container p-3 text-xs text-on-surface-variant">
                  現在のテーブルに関連レコードは見つかりません。
                </div>
              )}
            </div>
          </div>
        </AISidebar>
      </main>
    </>
  );
}

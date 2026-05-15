"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Badge } from "@/components/shared/Badge";
import { Icon } from "@/components/shared/Icon";
import { Button } from "@/components/shared/Button";
import { RecordActivitySections } from "@/components/runtime/RecordActivitySections";
import { RecordCreatePanel } from "@/components/runtime/RecordCreatePanel";
import { cn } from "@/lib/cn";
import {
  createComment,
  createRecord,
  getRuntimeTableMeta,
  listAttachments,
  listBackReferences,
  listComments,
  listRecords,
  uploadAttachment,
} from "@/lib/api/records";
import {
  buildReferenceRecordHref,
  formatDateTime,
  formatFieldKey,
  formatFieldValue,
  formatPriorityLabel,
  formatStatusLabel,
  getDisplayFields,
  getRecordFieldValueText,
  getReferenceDisplayFieldCode,
  getReferenceLookupFieldCodes,
  getReferenceRecordLabel,
  getReferenceTableCode,
  getReferenceValueIds,
  getPriorityVariant,
  getRecordCustomer,
  getRecordDescription,
  getRecordIdentifier,
  getRecordPriority,
  getRecordSentiment,
  getRecordTitle,
  getStatusVariant,
  type ReferenceFieldsByField,
  resolveRecordListReferences,
  resolveRecordReferences,
  type ReferenceRecordsByField,
} from "@/lib/runtime-records";
import type { ReferenceLabelsByField } from "@/lib/runtime-records";
import { useToastStore } from "@/stores/toastStore";
import type { AppField, RuntimeTableMeta } from "@/types/app";
import type {
  AppRecord,
  Attachment,
  RecordBackReferenceGroup,
  RecordComment,
} from "@/types/record";

const tabs = [
  { id: "all", label: "すべて" },
  { id: "open", label: "未対応" },
  { id: "priority", label: "優先度高" },
];

type MobileOverlay = "detail" | "create" | null;

interface MobileRecordDetailViewProps {
  appCode?: string;
  runtimeBasePath?: string;
  error?: string | null;
  record: AppRecord;
  fieldDefinitions?: AppField[];
  referenceLabelsByField?: ReferenceLabelsByField;
  referenceRecordsByField?: ReferenceRecordsByField;
  referenceFieldsByField?: ReferenceFieldsByField;
  backReferenceGroups?: RecordBackReferenceGroup[];
  isLoadingBackReferences?: boolean;
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

function MobileRecordDetailView({
  appCode,
  runtimeBasePath = "/m",
  error,
  record,
  fieldDefinitions = [],
  referenceLabelsByField = {},
  referenceRecordsByField = {},
  referenceFieldsByField = {},
  backReferenceGroups = [],
  isLoadingBackReferences = false,
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
  const resolvedRecord = resolveRecordReferences(
    record,
    fieldDefinitions,
    referenceLabelsByField
  );

  const description = getRecordDescription(resolvedRecord);
  const customer = getRecordCustomer(resolvedRecord) || "依頼者不明";
  const fields = getDisplayFields(resolvedRecord);

  function renderFieldContent(key: string, value: unknown) {
    const fieldDefinition = fieldDefinitions.find((field) => field.code === key);
    const rawValue = record.data[key];

    if (appCode && fieldDefinition?.fieldType === "master_ref") {
      const referenceTableCode = getReferenceTableCode(fieldDefinition);
      const referenceRecordIds = getReferenceValueIds(rawValue);

      if (referenceTableCode && referenceRecordIds.length > 0) {
        return (
          <div className="flex flex-wrap gap-2">
            {referenceRecordIds.map((referenceRecordId) => (
              <Link
                key={referenceRecordId}
                href={buildReferenceRecordHref(
                  runtimeBasePath,
                  appCode,
                  referenceTableCode,
                  referenceRecordId
                )}
                className="inline-flex items-center gap-1 rounded-full bg-primary-container px-3 py-1 font-semibold text-on-primary-container transition-colors hover:bg-primary hover:text-white"
              >
                <span>
                  {referenceLabelsByField[key]?.[referenceRecordId] ?? referenceRecordId}
                </span>
                <Icon name="arrow_outward" size="sm" />
              </Link>
            ))}
          </div>
        );
      }
    }

    return formatFieldValue(value);
  }

  function renderLookupDetails(fieldDefinition: AppField) {
    const lookupFieldCodes = getReferenceLookupFieldCodes(fieldDefinition);
    const referenceRecordIds = getReferenceValueIds(record.data[fieldDefinition.code]);

    if (lookupFieldCodes.length === 0 || referenceRecordIds.length === 0) {
      return null;
    }

    const recordsById = referenceRecordsByField[fieldDefinition.code] ?? {};
    const referenceFields = referenceFieldsByField[fieldDefinition.code] ?? [];
    const lookupCards = referenceRecordIds
      .map((referenceRecordId) => {
        const referenceRecord = recordsById[referenceRecordId];
        if (!referenceRecord) {
          return null;
        }

        const lookupValues = lookupFieldCodes
          .map((lookupFieldCode) => {
            const text = getRecordFieldValueText(referenceRecord, lookupFieldCode);
            if (!text) {
              return null;
            }

            return {
              fieldLabel: formatFieldKey(lookupFieldCode, referenceFields),
              value: text,
            };
          })
          .filter(
            (
              lookupValue
            ): lookupValue is { fieldLabel: string; value: string } =>
              lookupValue !== null
          );

        if (lookupValues.length === 0) {
          return null;
        }

        return {
          label:
            referenceLabelsByField[fieldDefinition.code]?.[referenceRecordId] ??
            getRecordTitle(referenceRecord),
          values: lookupValues,
        };
      })
      .filter(
        (
          lookupCard
        ): lookupCard is {
          label: string;
          values: Array<{ fieldLabel: string; value: string }>;
        } => lookupCard !== null
      );

    if (lookupCards.length === 0) {
      return null;
    }

    return (
      <div className="mt-3 space-y-2">
        {lookupCards.map((lookupCard) => (
          <div
            key={lookupCard.label}
            className="rounded-lg border border-tertiary-container bg-tertiary-container/40 p-3"
          >
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-on-tertiary-container">
              {lookupCard.label}
            </div>
            <div className="space-y-1">
              {lookupCard.values.map((lookupValue) => (
                <div
                  key={`${lookupCard.label}-${lookupValue.fieldLabel}`}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <span className="text-on-surface-variant">
                    {lookupValue.fieldLabel}
                  </span>
                  <span className="text-right text-on-surface">{lookupValue.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

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
    <div className="fixed inset-0 z-40 flex flex-col bg-surface-container-low">
      <header className="border-b border-outline-variant bg-surface px-4 pb-4 pt-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <Icon name="arrow_back" size="md" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={getStatusVariant(resolvedRecord.status)}>
                {formatStatusLabel(resolvedRecord.status)}
              </Badge>
              <span className="text-[10px] font-mono text-on-surface-variant">
                {getRecordIdentifier(resolvedRecord)}
              </span>
            </div>
            <h1 className="text-lg font-bold leading-tight text-on-surface">
              {getRecordTitle(resolvedRecord)}
            </h1>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-error-container bg-error-container/40 px-4 py-3 text-sm font-medium text-on-error-container">
            {error}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4">
        <div className="mb-4 rounded-2xl border border-outline-variant bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-on-surface">{customer}</span>
            <span className="text-[10px] text-on-surface-variant">
              {formatDateTime(resolvedRecord.createdAt)}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-on-surface">
            {description || "説明はありません"}
          </p>
        </div>

        {fields.length > 0 && (
          <div className="mb-5">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              レコードデータ
            </div>
            <div className="space-y-2">
              {fields.map(([key, value]) => (
                <div key={key} className="rounded-xl border border-outline-variant bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    {formatFieldKey(key, fieldDefinitions)}
                  </div>
                  <div className="text-sm text-on-surface">
                    {renderFieldContent(key, value)}
                  </div>
                  {(() => {
                    const fieldDefinition = fieldDefinitions.find((field) => field.code === key);
                    return fieldDefinition?.fieldType === "master_ref"
                      ? renderLookupDetails(fieldDefinition)
                      : null;
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}

        <RecordActivitySections
          appCode={appCode}
          runtimeBasePath={runtimeBasePath}
          backReferenceGroups={backReferenceGroups}
          isLoadingBackReferences={isLoadingBackReferences}
          comments={comments}
          attachments={attachments}
          isLoadingActivity={isLoadingActivity}
          isUploadingAttachment={isUploadingAttachment}
          compact
        />
      </div>

      <div className="border-t border-outline-variant bg-surface px-4 pb-6 pt-3 shadow-[0_-1px_2px_rgba(15,23,42,0.04)]">
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
            className="w-full rounded-xl border border-outline bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-muted hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              disabled={!onAddAttachment || isUploadingAttachment}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
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
  const searchParams = useSearchParams();
  const appCode = getParam(params.appCode);
  const tableCode = getParam(params.table);
  const requestedRecordId = searchParams.get("recordId")?.trim() ?? "";
  const pushToast = useToastStore((store) => store.pushToast);

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

  const selectedRecord =
    records.find((record) => record.id === selectedId) ?? null;
  const resolvedRecords = resolveRecordListReferences(
    records,
    tableMeta?.fields ?? [],
    referenceLabelsByField
  );

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
        if (
          requestedRecordId &&
          nextRecords.some((record) => record.id === requestedRecordId)
        ) {
          setActiveOverlay("detail");
        }
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
  }, [appCode, requestedRecordId, tableCode]);

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
  }, [appCode, tableMeta]);

  useEffect(() => {
    if (!appCode || !tableCode || !selectedId || activeOverlay !== "detail") {
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

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRecords = resolvedRecords.filter((record) => {
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
  const emptyMessage = normalizedQuery
    ? "検索条件に一致するレコードはありません。"
    : "まだレコードがありません。新規レコードから作成できます。";

  return (
    <div className="flex min-h-screen flex-col bg-surface-container-low">
      <header className="glass-effect sticky top-0 z-20 px-4 pb-4 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              モバイル実行画面
            </div>
            <h1 className="font-headline text-base font-extrabold tracking-tight text-on-surface">
              {tableMeta?.table.name || "実行画面"}
            </h1>
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface-variant transition-colors hover:bg-surface-container-high">
            <Icon name="notifications" size="md" />
          </button>
        </div>
        <div className="relative">
          <Icon
            name="search"
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="レコードを検索..."
            className="w-full rounded-full border border-outline bg-surface py-2.5 pl-9 pr-4 text-sm text-on-surface placeholder:text-on-surface-muted hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </header>

      <div className="overflow-x-auto border-b border-outline-variant px-4 py-3">
        <div className="flex min-w-max gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-wider transition-colors",
                activeTab === tab.id
                  ? "bg-primary-container text-on-primary-container"
                  : "border border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {error && activeOverlay === null && (
          <div className="mb-3 rounded-lg border border-error-container bg-error-container/40 px-4 py-3 text-sm font-medium text-on-error-container">
            {error}
          </div>
        )}

        {(isLoadingRecords || isLoadingMeta) && (
          <div className="rounded-xl border border-outline-variant bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] text-sm text-on-surface-variant">
            レコードを読み込んでいます...
          </div>
        )}

        {!isLoadingRecords && filteredRecords.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low p-6 text-center text-sm text-on-surface-variant">
            {emptyMessage}
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
                className="block w-full rounded-xl border border-outline-variant bg-surface p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all active:scale-[0.99] hover:shadow-[0_2px_4px_rgba(15,23,42,0.06)]"
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

                <h3 className="mb-1.5 text-[14px] font-semibold leading-snug tracking-tight text-on-surface">
                  {getRecordTitle(record)}
                </h3>

                <p className="mb-3 line-clamp-2 text-[12px] leading-relaxed text-on-surface-variant">
                  {getRecordDescription(record) || "説明はありません"}
                </p>

                <div className="flex items-center justify-between border-t border-outline-variant pt-2.5">
                  <span className="text-[10.5px] font-medium text-on-surface-muted">
                    {formatStatusLabel(record.status)}
                  </span>
                  <span className="flex items-center gap-1 text-[10.5px] font-semibold text-primary">
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
            <span className="text-[10px] font-semibold tracking-wider">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setActiveOverlay("create")}
        disabled={isLoadingMeta}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_4px_8px_rgba(240,106,106,0.25),0_8px_24px_rgba(240,106,106,0.18)] transition-all hover:bg-primary-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon name="add" size="lg" className="text-on-surface" />
      </button>

      {activeOverlay === "detail" && selectedRecord && (
        <MobileRecordDetailView
          appCode={appCode}
          runtimeBasePath="/m"
          error={error}
          record={selectedRecord}
          fieldDefinitions={tableMeta?.fields}
          referenceLabelsByField={referenceLabelsByField}
          referenceRecordsByField={referenceRecordsByField}
          referenceFieldsByField={referenceFieldsByField}
          backReferenceGroups={backReferenceGroups}
          isLoadingBackReferences={isLoadingBackReferences}
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
        <div className="fixed inset-0 z-40 overflow-y-auto bg-surface-container-low pb-24 pt-4">
          {error && (
            <div className="mx-4 mb-3 rounded-lg border border-error-container bg-error-container/40 px-4 py-3 text-sm font-medium text-on-error-container">
              {error}
            </div>
          )}
          <RecordCreatePanel
            key={`mobile-create-${tableMeta?.table.id ?? tableCode}`}
            appCode={appCode}
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

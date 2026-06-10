"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
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
  formatRelativeTime,
  formatStatusLabel,
  getDisplayFields,
  getRecordFieldValueText,
  getReferenceAppCode,
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
import {
  addMonths,
  applyViewQuery,
  filterRecordsByView,
  formatDateGroupLabel,
  formatMonthLabel,
  formatNumber,
  getCalendarDays,
  getChartBuckets,
  getCurrentMonthKey,
  getDateFieldCode,
  getFieldDisplayLabel,
  getGroupFieldCode,
  getMetricFieldCode,
  getNumericMetricValues,
  getViewColumns,
  getViewFilters,
  getVisibleFields,
  groupRecordsByDate,
  groupRecordsByField,
  sortRecordsByView,
} from "@/lib/runtime-views";
import type { ReferenceLabelsByField } from "@/lib/runtime-records";
import { useToastStore } from "@/stores/toastStore";
import type { AppField, AppViewType, RuntimeTableMeta } from "@/types/app";
import type {
  AppRecord,
  Attachment,
  RecordBackReferenceGroup,
  RecordComment,
} from "@/types/record";

const MOBILE_VIEW_META: Record<AppViewType, { label: string; icon: string }> = {
  list: { label: "一覧", icon: "view_list" },
  kanban: { label: "カンバン", icon: "view_kanban" },
  calendar: { label: "カレンダー", icon: "calendar_month" },
  chart: { label: "チャート", icon: "insert_chart" },
  kpi: { label: "KPI", icon: "speed" },
};

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
      const referenceAppCode = getReferenceAppCode(fieldDefinition) || appCode;
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
                  referenceAppCode,
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

interface MobileRecordCardProps {
  record: AppRecord;
  fields: AppField[];
  visibleColumnCodes: string[];
  selectedId?: string | null;
  compact?: boolean;
  onOpen: (recordId: string) => void;
}

function MobileRecordCard({
  record,
  fields,
  visibleColumnCodes,
  selectedId,
  compact = false,
  onOpen,
}: MobileRecordCardProps) {
  const priority = getRecordPriority(record);
  const sentiment = getRecordSentiment(record);
  const isSelected = selectedId === record.id;
  const visibleFields = getVisibleFields(
    record,
    visibleColumnCodes,
    fields,
    compact ? 2 : 3
  );

  return (
    <button
      type="button"
      data-testid={`mobile-record-card-${record.id}`}
      onClick={() => onOpen(record.id)}
      className={cn(
        "block w-full rounded-xl border bg-surface p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all active:scale-[0.99] hover:shadow-[0_2px_4px_rgba(15,23,42,0.06)]",
        isSelected ? "border-primary bg-primary-container/30" : "border-outline-variant",
        compact && "p-3"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[10px] font-mono text-on-surface-variant">
          {getRecordIdentifier(record)}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {typeof sentiment === "number" && sentiment < -0.5 && (
            <Badge variant="ai">要確認</Badge>
          )}
          {priority && !compact && (
            <Badge variant={getPriorityVariant(priority)}>
              {formatPriorityLabel(priority)}
            </Badge>
          )}
          <Badge variant={getStatusVariant(record.status)}>
            {formatStatusLabel(record.status)}
          </Badge>
        </div>
      </div>

      <h3 className="mb-1.5 line-clamp-2 text-[14px] font-semibold leading-snug tracking-tight text-on-surface">
        {getRecordTitle(record)}
      </h3>

      {!compact && (
        <p className="mb-3 line-clamp-2 text-[12px] leading-relaxed text-on-surface-variant">
          {getRecordDescription(record) || "説明はありません"}
        </p>
      )}

      {visibleFields.length > 0 && (
        <div className="mb-3 space-y-1">
          {visibleFields.map((field) => (
            <div
              key={field.fieldCode}
              className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 text-[11px]"
            >
              <span className="truncate text-on-surface-muted">{field.label}</span>
              <span className="truncate text-on-surface-variant">
                {formatFieldValue(field.value)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-outline-variant pt-2.5">
        <span className="text-[10.5px] text-on-surface-muted">
          {formatRelativeTime(record.updatedAt)}
        </span>
        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-primary">
          <Icon name="visibility" size="sm" />
          開く
        </span>
      </div>
    </button>
  );
}

export default function MobileRuntimePage() {
  const params = useParams<{ appCode: string; table: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const appCode = getParam(params.appCode);
  const tableCode = getParam(params.table);
  const requestedRecordId = searchParams.get("recordId")?.trim() ?? "";
  const requestedViewId = searchParams.get("viewId")?.trim() ?? "";
  const pushToast = useToastStore((store) => store.pushToast);

  const [activeViewId, setActiveViewId] = useState("");
  const [calendarMonthKey, setCalendarMonthKey] = useState<string | null>(null);
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
        setActiveViewId((current) => {
          const fallbackViewId = nextMeta.views[0]?.id ?? "";

          if (requestedViewId) {
            return nextMeta.views.some((view) => view.id === requestedViewId)
              ? requestedViewId
              : fallbackViewId;
          }

          return current && nextMeta.views.some((view) => view.id === current)
            ? current
            : fallbackViewId;
        });
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
  }, [appCode, requestedViewId, tableCode]);

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
          appCode: getReferenceAppCode(field) || appCode,
          tableCode: getReferenceTableCode(field),
          displayFieldCode: getReferenceDisplayFieldCode(field),
        }))
        .filter(
          (field): field is {
            fieldCode: string;
            appCode: string;
            tableCode: string;
            displayFieldCode: string;
          } =>
            Boolean(field.appCode && field.tableCode)
        );

      if (referenceFields.length === 0) {
        setReferenceLabelsByField({});
        setReferenceRecordsByField({});
        setReferenceFieldsByField({});
        return;
      }

      try {
        const getTargetKey = (field: { appCode: string; tableCode: string }) =>
          `${field.appCode}:${field.tableCode}`;
        const uniqueReferenceTargets = [
          ...new Map(
            referenceFields.map((field) => [getTargetKey(field), field])
          ).values(),
        ];
        const [recordsByTargetKey, metaByTargetKey] = await Promise.all([
          Object.fromEntries(
            await Promise.all(
              uniqueReferenceTargets.map(async (field) => [
                getTargetKey(field),
                await listRecords(field.appCode, field.tableCode),
              ])
            )
          ) as Record<string, AppRecord[]>,
          Object.fromEntries(
            await Promise.all(
              uniqueReferenceTargets.map(async (field) => [
                getTargetKey(field),
                await getRuntimeTableMeta(field.appCode, field.tableCode),
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
          const targetKey = getTargetKey(referenceField);
          const records = recordsByTargetKey[targetKey] ?? [];
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
            metaByTargetKey[targetKey]?.fields ?? [];
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

  function handleViewChange(viewId: string) {
    setActiveViewId(viewId);

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    if (viewId) {
      nextSearchParams.set("viewId", viewId);
    } else {
      nextSearchParams.delete("viewId");
    }

    const queryString = nextSearchParams.toString();
    router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, {
      scroll: false,
    });
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

  const fields = tableMeta?.fields ?? [];
  const activeView =
    tableMeta?.views.find((view) => view.id === activeViewId) ??
    tableMeta?.views[0];
  const activeViewType = activeView?.viewType ?? "list";
  const visibleColumnCodes = getViewColumns(activeView, fields);
  const filteredRecords = applyViewQuery(
    sortRecordsByView(
      filterRecordsByView(resolvedRecords, getViewFilters(activeView)),
      activeView
    ),
    visibleColumnCodes,
    query
  );
  const groupFieldCode = getGroupFieldCode(activeView, fields);
  const dateFieldCode = getDateFieldCode(activeView, fields);
  const metricFieldCode = getMetricFieldCode(activeView, fields);
  const metricLabel = metricFieldCode
    ? getFieldDisplayLabel(metricFieldCode, fields)
    : "件数";
  const kanbanGroups = groupRecordsByField(filteredRecords, groupFieldCode, fields);
  const calendarGroups = groupRecordsByDate(filteredRecords, dateFieldCode);
  const recordsByDate = new Map(
    calendarGroups.map((group) => [group.key, group.records] as const)
  );
  const firstCalendarMonthKey =
    calendarGroups.find((group) => group.key !== "日付なし")?.key.slice(0, 7) ??
    getCurrentMonthKey();
  const displayedCalendarMonthKey = calendarMonthKey ?? firstCalendarMonthKey;
  const calendarDays = getCalendarDays(displayedCalendarMonthKey, recordsByDate);
  const undatedCalendarGroup = calendarGroups.find(
    (group) => group.key === "日付なし"
  );
  const chartBuckets = getChartBuckets(filteredRecords, fields, activeView);
  const metricValues = getNumericMetricValues(filteredRecords, metricFieldCode);
  const metricTotal = metricValues.reduce((total, value) => total + value, 0);
  const metricAverage =
    metricValues.length > 0 ? metricTotal / metricValues.length : 0;
  const doneCount = filteredRecords.filter(
    (record) => getStatusVariant(record.status) === "success"
  ).length;
  const emptyMessage = query.trim()
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
          {(tableMeta?.views ?? []).map((view) => {
            const viewMeta = MOBILE_VIEW_META[view.viewType];
            const isActive = view.id === activeView?.id;

            return (
              <button
                key={view.id}
                type="button"
                data-testid={`mobile-runtime-view-tab-${view.id}`}
                onClick={() => handleViewChange(view.id)}
                className={cn(
                  "inline-flex whitespace-nowrap rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-wider transition-colors",
                  isActive
                    ? "bg-primary-container text-on-primary-container"
                    : "border border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low"
                )}
              >
                <Icon name={viewMeta.icon} size="sm" className="mr-1 text-[14px]" />
                {view.name}
              </button>
            );
          })}
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

        {!isLoadingRecords && !isLoadingMeta && filteredRecords.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low p-6 text-center text-sm text-on-surface-variant">
            {emptyMessage}
          </div>
        )}

        {!isLoadingRecords &&
          !isLoadingMeta &&
          filteredRecords.length > 0 &&
          activeViewType === "list" && (
            <div className="space-y-3" data-testid="mobile-runtime-list-view">
              {filteredRecords.map((record) => (
                <MobileRecordCard
                  key={record.id}
                  record={record}
                  fields={fields}
                  visibleColumnCodes={visibleColumnCodes}
                  selectedId={selectedId}
                  onOpen={openDetail}
                />
              ))}
            </div>
          )}

        {!isLoadingRecords &&
          !isLoadingMeta &&
          filteredRecords.length > 0 &&
          activeViewType === "kanban" && (
            <div
              className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4"
              data-testid="mobile-runtime-kanban-view"
            >
              {kanbanGroups.map((group) => (
                <section
                  key={group.key}
                  className="flex max-h-[calc(100vh-16rem)] w-72 shrink-0 flex-col rounded-xl border border-outline-variant bg-surface-container-low"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-outline-variant px-3 py-2">
                    <div className="min-w-0 truncate text-sm font-semibold text-on-surface">
                      {group.label}
                    </div>
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
                      {group.records.length}
                    </span>
                  </div>
                  <div className="space-y-2 overflow-y-auto p-2">
                    {group.records.map((record) => (
                      <MobileRecordCard
                        key={record.id}
                        record={record}
                        fields={fields}
                        visibleColumnCodes={visibleColumnCodes}
                        selectedId={selectedId}
                        compact
                        onOpen={openDetail}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

        {!isLoadingRecords &&
          !isLoadingMeta &&
          filteredRecords.length > 0 &&
          activeViewType === "calendar" && (
            <div className="space-y-3" data-testid="mobile-runtime-calendar-view">
              <section className="rounded-xl border border-outline-variant bg-surface">
                <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-on-surface">
                      {formatMonthLabel(displayedCalendarMonthKey)}
                    </div>
                    <div className="text-[10px] text-on-surface-variant">
                      {getFieldDisplayLabel(dateFieldCode, fields)} 別
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarMonthKey((current) =>
                          addMonths(current ?? displayedCalendarMonthKey, -1)
                        )
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-outline-variant bg-surface text-on-surface-variant"
                      aria-label="前月"
                    >
                      <Icon name="chevron_left" size="sm" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarMonthKey(firstCalendarMonthKey)}
                      className="h-8 rounded-md border border-outline-variant bg-surface px-2 text-[11px] font-semibold text-on-surface-variant"
                    >
                      初期
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarMonthKey((current) =>
                          addMonths(current ?? displayedCalendarMonthKey, 1)
                        )
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-outline-variant bg-surface text-on-surface-variant"
                      aria-label="翌月"
                    >
                      <Icon name="chevron_right" size="sm" />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto p-2">
                  <div className="min-w-[560px]">
                    <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-on-surface-muted">
                      {["日", "月", "火", "水", "木", "金", "土"].map((weekday) => (
                        <div key={weekday} className="py-2">
                          {weekday}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 rounded-lg border border-outline-variant">
                      {calendarDays.map((day) => (
                        <div
                          key={day.key}
                          className={cn(
                            "min-h-24 border-b border-r border-outline-variant bg-surface p-1.5",
                            !day.inMonth && "bg-surface-container-low text-on-surface-muted",
                            day.isToday && "bg-primary-container/30"
                          )}
                        >
                          <div className="mb-1 flex items-center justify-between gap-1">
                            <span
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                                day.isToday
                                  ? "bg-primary text-white"
                                  : "text-on-surface-variant"
                              )}
                            >
                              {day.day}
                            </span>
                            {day.records.length > 0 && (
                              <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[9px] font-semibold text-on-surface-variant">
                                {day.records.length}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            {day.records.slice(0, 2).map((record) => (
                              <button
                                key={record.id}
                                type="button"
                                onClick={() => openDetail(record.id)}
                                className="block w-full rounded-md bg-primary-container/60 px-1.5 py-1 text-left text-[10px] font-semibold leading-tight text-on-primary-container"
                              >
                                <span className="block truncate">
                                  {getRecordTitle(record)}
                                </span>
                              </button>
                            ))}
                            {day.records.length > 2 && (
                              <div className="rounded-md bg-surface-container-high px-1.5 py-1 text-[9px] font-semibold text-on-surface-variant">
                                +{day.records.length - 2}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {undatedCalendarGroup && undatedCalendarGroup.records.length > 0 && (
                <section className="rounded-xl border border-outline-variant bg-surface-container-low">
                  <div className="flex items-center justify-between gap-2 border-b border-outline-variant px-3 py-2">
                    <div className="truncate text-sm font-semibold text-on-surface">
                      {formatDateGroupLabel(undatedCalendarGroup.label)}
                    </div>
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
                      {undatedCalendarGroup.records.length}
                    </span>
                  </div>
                  <div className="space-y-2 p-2">
                    {undatedCalendarGroup.records.map((record) => (
                      <MobileRecordCard
                        key={record.id}
                        record={record}
                        fields={fields}
                        visibleColumnCodes={visibleColumnCodes}
                        selectedId={selectedId}
                        compact
                        onOpen={openDetail}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

        {!isLoadingRecords &&
          !isLoadingMeta &&
          filteredRecords.length > 0 &&
          activeViewType === "chart" && (
            <div className="space-y-3" data-testid="mobile-runtime-chart-view">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-outline-variant bg-surface p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                    レコード
                  </div>
                  <div className="mt-2 text-2xl font-bold text-on-surface">
                    {filteredRecords.length}
                  </div>
                </div>
                <div className="rounded-xl border border-outline-variant bg-surface p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                    指標
                  </div>
                  <div className="mt-2 truncate text-sm font-bold text-on-surface">
                    {metricLabel}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {chartBuckets.map((bucket) => (
                  <button
                    key={bucket.key}
                    type="button"
                    onClick={() => openDetail(bucket.records[0].id)}
                    className="w-full rounded-xl border border-outline-variant bg-surface p-3 text-left"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-semibold text-on-surface">
                        {bucket.label}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-on-surface-variant">
                        {metricFieldCode
                          ? formatNumber(bucket.value)
                          : `${bucket.records.length}件`}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-container-high">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${bucket.percent}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        {!isLoadingRecords &&
          !isLoadingMeta &&
          filteredRecords.length > 0 &&
          activeViewType === "kpi" && (
            <div className="space-y-3" data-testid="mobile-runtime-kpi-view">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["総レコード", filteredRecords.length],
                  ["完了", doneCount],
                  [`${metricLabel} 合計`, metricFieldCode ? formatNumber(metricTotal) : "-"],
                  [
                    `${metricLabel} 平均`,
                    metricFieldCode ? formatNumber(metricAverage) : "-",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-outline-variant bg-surface p-4"
                  >
                    <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                      {label}
                    </div>
                    <div className="mt-2 truncate text-2xl font-bold text-on-surface">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <section className="rounded-xl border border-outline-variant bg-surface-container-low">
                <div className="border-b border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface">
                  最近更新されたレコード
                </div>
                <div className="space-y-2 p-2">
                  {filteredRecords.slice(0, 5).map((record) => (
                    <MobileRecordCard
                      key={record.id}
                      record={record}
                      fields={fields}
                      visibleColumnCodes={visibleColumnCodes}
                      selectedId={selectedId}
                      compact
                      onOpen={openDetail}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}
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

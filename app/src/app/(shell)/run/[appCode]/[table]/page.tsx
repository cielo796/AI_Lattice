"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { mergeRecordComments } from "@/lib/runtime/comments";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { RecordAIPanel } from "@/components/ai/RecordAIPanel";
import { RecordCreatePanel } from "@/components/runtime/RecordCreatePanel";
import { RecordDetail } from "@/components/runtime/RecordDetail";
import { RecordDetailPanel, useRecordDrawer } from "@/components/runtime/RecordDetailPanel";
import { RecordList } from "@/components/runtime/RecordList";
import { TableHeader } from "@/components/runtime/TableHeader";
import { Icon } from "@/components/shared/Icon";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getAppByCode } from "@/lib/api/apps";
import { ApiError } from "@/lib/api/client";
import { getCurrentPermissions, type PermissionMap } from "@/lib/api/rbac";
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
  submitRecordApproval,
  updateRecord,
  uploadAttachment,
} from "@/lib/api/records";
import {
  formatRelativeTime,
  formatPriorityLabel,
  formatStatusLabel,
  getReferenceAppCode,
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
import { applyViewQuery, filterRecordsByView, getViewColumns, getViewFilters, sortRecordsByView } from "@/lib/runtime-views";
import { useToastStore } from "@/stores/toastStore";
import type { ReferenceLabelsByField } from "@/lib/runtime-records";
import type { AppField, RuntimeTableMeta } from "@/types/app";
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

const EMPTY_FIELDS: AppField[] = [];

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const appCode = getParam(params.appCode);
  const tableCode = getParam(params.table);
  const requestedRecordId = searchParams.get("recordId")?.trim() ?? "";
  const requestedViewId = searchParams.get("viewId")?.trim() ?? "";
  const pushToast = useToastStore((store) => store.pushToast);

  const [records, setRecords] = useState<AppRecord[]>([]);
  const [comments, setComments] = useState<RecordComment[]>([]);
  const commentsRevision = useRef(0);
  const activityRecordId = useRef<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [recordId, setRecordId] = useState<string | null>(requestedRecordId || null);
  // Arrow keys can select a row without opening its drawer until Enter.
  const [keyboardSelectionId, setKeyboardSelectionId] = useState<string | null>(null);
  const [tableMeta, setTableMeta] = useState<RuntimeTableMeta | null>(null);
  const [permissions, setPermissions] = useState<PermissionMap | null>(null);
  const [appName, setAppName] = useState("");
  const [query, setQuery] = useState("");
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [recordPanelMode, setRecordPanelMode] = useState<RecordPanelMode>(null);
  const [panelFocusVersion, setPanelFocusVersion] = useState(0);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
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
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedRecord = records.find((record) => record.id === recordId) ?? null;
  const selectedId = selectedRecord?.id ?? null;
  const detailRecord = selectedRecord && selectedId !== keyboardSelectionId ? selectedRecord : null;
  const detailId = detailRecord?.id ?? null;
  const fields = tableMeta?.fields ?? EMPTY_FIELDS;
  const activeView =
    tableMeta?.views.find((view) => view.id === requestedViewId) ?? tableMeta?.views[0];
  const resolvedRecords = useMemo(
    () => resolveRecordListReferences(records, fields, referenceLabelsByField),
    [records, fields, referenceLabelsByField]
  );
  const resolvedDetailRecord = resolvedRecords.find((record) => record.id === detailId) ?? null;
  const visibleColumnCodes = useMemo(() => getViewColumns(activeView, fields), [activeView, fields]);
  const viewRecords = useMemo(
    () => sortRecordsByView(filterRecordsByView(resolvedRecords, getViewFilters(activeView)), activeView),
    [resolvedRecords, activeView]
  );
  const filteredRecords = useMemo(
    () => applyViewQuery(viewRecords, visibleColumnCodes, query),
    [viewRecords, visibleColumnCodes, query]
  );
  const formMode = recordPanelMode === "create" || (recordPanelMode === "edit" && detailRecord)
    ? recordPanelMode
    : null;
  const panelOpen = Boolean(formMode || detailRecord);
  const isDrawer = useRecordDrawer();
  const listRef = useRef<HTMLDivElement>(null);
  const panelOpener = useRef<HTMLElement | null>(null);
  const previousPanel = useRef<{ open: boolean; recordId: string | null }>({ open: false, recordId: null });

  useLayoutEffect(() => {
    const previous = previousPanel.current;
    previousPanel.current = { open: panelOpen, recordId: formMode === "create" ? null : detailId };
    if (!previous.open || panelOpen) {
      return;
    }

    const list = listRef.current;
    const rowButton = previous.recordId
      ? list?.querySelector<HTMLElement>(`[data-record-row-trigger="${CSS.escape(previous.recordId)}"], button[data-testid="record-row-${CSS.escape(previous.recordId)}"]`)
      : null;
    const opener = panelOpener.current;
    panelOpener.current = null;
    const nextFocus = rowButton ?? (opener?.isConnected ? opener : null) ??
      list?.querySelector<HTMLElement>('[data-record-row-trigger][tabindex="0"], button[data-testid^="record-row-"]') ??
      list?.querySelector<HTMLElement>('input[type="search"]');
    nextFocus?.focus();
  }, [detailId, formMode, panelOpen]);

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
        setIsAccessDenied(false);
        setError(null);
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setRecords([]);
        setComments([]);
        setAttachments([]);
        setApprovals([]);
        setIsAccessDenied(nextError instanceof ApiError && nextError.status === 403);
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
  }, [appCode, refreshKey, tableCode]);

  useEffect(() => {
    setRecordId(requestedRecordId || null);
  }, [pathname, requestedRecordId]);

  useEffect(() => {
    function restoreUrlSelection() {
      const url = new URLSearchParams(window.location.search);
      setRecordId(url.get("recordId")?.trim() || null);
      setKeyboardSelectionId(null);
      setRecordPanelMode(null);
    }
    window.addEventListener("popstate", restoreUrlSelection);
    return () => window.removeEventListener("popstate", restoreUrlSelection);
  }, []);

  useEffect(() => {
    if (!appCode || !tableCode) {
      return;
    }

    let cancelled = false;

    async function loadRuntimeMeta() {
      try {
        setIsLoadingMeta(true);
        const [nextMeta, app] = await Promise.all([
          getRuntimeTableMeta(appCode, tableCode),
          getAppByCode(appCode),
        ]);
        const nextPermissions = await getCurrentPermissions({
          appId: app.id,
          tableId: nextMeta.table.id,
        });

        if (cancelled) {
          return;
        }

        setTableMeta(nextMeta);
        setPermissions(nextPermissions);
        setAppName(app.name);
        setError(null);
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setTableMeta(null);
        setAppName("");
        setPermissions(null);
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
  }, [appCode, refreshKey, tableCode]);

  function handleViewChange(viewId: string) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    if (viewId) {
      nextSearchParams.set("viewId", viewId);
    } else {
      nextSearchParams.delete("viewId");
    }

    const query = nextSearchParams.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }

  function buildRuntimeHref(recordId: string | null) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    if (recordId) {
      nextSearchParams.set("recordId", recordId);
    } else {
      nextSearchParams.delete("recordId");
    }

    const query = nextSearchParams.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }

  function rememberPanelOpener() {
    const active = document.activeElement;
    if (!panelOpen && active instanceof HTMLElement && listRef.current?.contains(active)) {
      panelOpener.current = active;
    }
  }

  function openRecordDetail(record: AppRecord) {
    rememberPanelOpener();
    setRecordPanelMode(null);
    setKeyboardSelectionId(null);
    setRecordId(record.id);
    setPanelFocusVersion((current) => current + 1);
    router.push(buildRuntimeHref(record.id), { scroll: false });
  }

  function navigateRecord(record: AppRecord) {
    setRecordPanelMode(null);
    setKeyboardSelectionId(detailRecord ? null : record.id);
    setRecordId(record.id);
    router.replace(buildRuntimeHref(record.id), { scroll: false });
  }

  function clearRecordDetail() {
    setKeyboardSelectionId(null);
    setRecordId(null);
    router.replace(buildRuntimeHref(null), { scroll: false });
  }

  function closeRecordPanel() {
    if (formMode) {
      setRecordPanelMode(null);
    } else {
      clearRecordDetail();
    }
  }

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
  }, [appCode, refreshKey, tableMeta]);

  useEffect(() => {
    if (!appCode || !tableCode || !detailId) {
      setBackReferenceGroups([]);
      setIsLoadingBackReferences(false);
      return;
    }

    setBackReferenceGroups([]);
    const currentRecordId = detailId;
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
  }, [appCode, refreshKey, detailId, tableCode]);

  useEffect(() => {
    activityRecordId.current = detailId;
    if (!appCode || !tableCode || !detailId) {
      setComments([]);
      setAttachments([]);
      setApprovals([]);
      return;
    }

    const currentRecordId = detailId;
    const requestedCommentsRevision = commentsRevision.current;
    setComments((current) => current.filter((comment) => comment.recordId === currentRecordId));
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

        setComments((current) => mergeRecordComments(
          nextComments,
          commentsRevision.current === requestedCommentsRevision ? [] : current,
          currentRecordId
        ));
        setAttachments(nextAttachments);
        setApprovals(nextApprovals);
        setError(null);
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        if (commentsRevision.current === requestedCommentsRevision) setComments([]);
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
      activityRecordId.current = null;
    };
  }, [appCode, refreshKey, detailId, tableCode]);

  async function handleAddComment(commentText: string) {
    if (!appCode || !tableCode || !detailId) {
      return;
    }

    try {
      setIsSubmittingComment(true);
      const currentRecordId = detailId;
      const comment = await createComment(appCode, tableCode, currentRecordId, {
        commentText,
      });
      if (activityRecordId.current === currentRecordId) {
        commentsRevision.current += 1;
        setComments((current) => mergeRecordComments([comment], current, currentRecordId));
      }
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

  async function handleSubmitApproval() {
    if (!appCode || !tableCode || !detailRecord) {
      return;
    }

    try {
      setIsSubmittingApproval(true);
      const approval = await submitRecordApproval(
        appCode,
        tableCode,
        detailRecord.id
      );
      setApprovals((current) => [approval, ...current]);
      setRefreshKey((current) => current + 1);
      setError(null);
      pushToast({ title: "承認申請を作成しました", variant: "success" });
    } catch (nextError) {
      const errorMessage =
        nextError instanceof Error
          ? nextError.message
          : "承認申請の作成に失敗しました。";
      setError(errorMessage);
      pushToast({
        title: "承認申請の作成に失敗しました",
        description: errorMessage,
        variant: "error",
      });
    } finally {
      setIsSubmittingApproval(false);
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
      openRecordDetail(record);
      setComments([]);
      setAttachments([]);
      setApprovals([]);
      setRecordPanelMode(null);
      setRefreshKey((current) => current + 1);
      setError(null);
      pushToast({ title: "レコードを作成しました", description: record.workflowDispatchPending ? "ワークフローは実行待ちです。保存は完了しています。" : undefined, variant: "success" });
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
      pushToast({ title: "レコードを更新しました", description: record.workflowDispatchPending ? "ワークフローは実行待ちです。保存は完了しています。" : undefined, variant: "success" });
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

      setRecords((current) => current.filter((record) => record.id !== selectedRecord.id));
      if (activityRecordId.current === selectedRecord.id) {
        clearRecordDetail();
        setComments([]);
        setAttachments([]);
        setApprovals([]);
        setRecordPanelMode(null);
      }
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
    if (!appCode || !tableCode || !detailId) {
      return;
    }

    try {
      setIsUploadingAttachment(true);
      const attachment = await uploadAttachment(appCode, tableCode, detailId, file);
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
    if (!appCode || !tableCode || !detailId) {
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
      await deleteAttachment(appCode, tableCode, detailId, attachmentId);
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

  const canWriteRecords = permissions?.["record:write"] === true;
  const formTitle = formMode === "edit" ? "レコードを編集" : "レコードを追加";

  return (
    <main className="flex min-h-dvh min-w-0 bg-surface" data-guide="runtime-table-main">
      <div ref={listRef} className="min-w-0 flex-1" inert={isDrawer && panelOpen}>
        <TableHeader
          appCode={appCode}
          appName={appName || appCode}
          tableName={tableMeta?.table.name || tableCode || "レコード"}
          tableCode={tableCode}
          views={tableMeta?.views ?? []}
          activeView={activeView}
          recordCount={filteredRecords.length}
          query={query}
          canWriteRecords={canWriteRecords}
          isLoadingMeta={isLoadingMeta}
          onQueryChange={setQuery}
          onViewChange={handleViewChange}
          onRefresh={() => setRefreshKey((current) => current + 1)}
          onCreate={() => {
            rememberPanelOpener();
            setRecordPanelMode("create");
          }}
        />

        {isAccessDenied && (
          <div className="flex items-center gap-2 border-b border-error/20 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
            <Icon name="lock" size="sm" />
            このテーブルを表示する権限がありません。
          </div>
        )}
        {error && !isAccessDenied && (
          <div className="border-b border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        <RecordList
          filteredRecords={filteredRecords}
          fields={fields}
          activeView={activeView}
          visibleColumnCodes={visibleColumnCodes}
          pageResetKey={`${appCode}:${tableCode}:${activeView?.id ?? ""}:${query.trim()}`}
          hasQuery={Boolean(query.trim())}
          selectedId={selectedId ?? undefined}
          detailOpen={Boolean(detailRecord)}
          isLoading={isLoadingMeta || isLoadingRecords}
          onSelect={openRecordDetail}
          onNavigate={navigateRecord}
        />
      </div>

      {(formMode || detailRecord) && (
        <RecordDetailPanel
          {...(!formMode && resolvedDetailRecord ? { record: resolvedDetailRecord } : { formTitle })}
          isDrawer={isDrawer}
          focusVersion={panelFocusVersion}
          onClose={closeRecordPanel}
        >
          {formMode ? (
            <RecordCreatePanel
              key={formMode === "edit" ? `edit-${detailRecord?.id}` : "create"}
              appCode={appCode}
              fields={fields}
              forms={tableMeta?.forms ?? []}
              mode={formMode}
              initialRecord={formMode === "edit" ? detailRecord : null}
              tableName={tableMeta?.table.name}
              inPanel
              isSubmitting={isSavingRecord}
              onClose={closeRecordPanel}
              onSubmit={formMode === "edit" ? handleUpdateRecord : handleCreateRecord}
            />
          ) : detailRecord && (
            <>
              <RecordDetail
                key={detailRecord.id}
                appCode={appCode}
                runtimeBasePath="/run"
                record={detailRecord}
                fieldDefinitions={fields}
                referenceLabelsByField={referenceLabelsByField}
                referenceRecordsByField={referenceRecordsByField}
                referenceFieldsByField={referenceFieldsByField}
                backReferenceGroups={backReferenceGroups}
                isLoadingBackReferences={isLoadingBackReferences}
                comments={comments.filter((item) => item.recordId === detailRecord.id)}
                attachments={attachments.filter((item) => item.recordId === detailRecord.id)}
                approvals={approvals.filter((item) => item.recordId === detailRecord.id)}
                isLoadingActivity={isLoadingActivity}
                isLoadingApprovals={isLoadingActivity}
                isSubmittingComment={isSubmittingComment}
                isSubmittingApproval={isSubmittingApproval}
                isUploadingAttachment={isUploadingAttachment}
                isDeletingRecord={isDeletingRecord}
                deletingAttachmentId={deletingAttachmentId}
                onAddComment={canWriteRecords ? handleAddComment : undefined}
                onSubmitApproval={canWriteRecords ? handleSubmitApproval : undefined}
                onAddAttachment={canWriteRecords ? handleAddAttachment : undefined}
                onEditRecord={canWriteRecords ? () => setRecordPanelMode("edit") : undefined}
                onDeleteRecord={canWriteRecords ? handleDeleteRecord : undefined}
                onDeleteAttachment={canWriteRecords ? handleDeleteAttachment : undefined}
              />
              <section className="mx-4 rounded-lg bg-primary-container p-4" data-guide="runtime-ai-panel">
                <RecordAIPanel
                  key={detailRecord.id}
                  appCode={appCode}
                  tableCode={tableCode}
                  record={detailRecord}
                  fallbackSummary={buildSummary(resolvedDetailRecord)}
                  fallbackActions={buildRecommendedActions(resolvedDetailRecord)}
                  isPostingReply={isSubmittingComment}
                  onPostReply={canWriteRecords ? handleAddComment : undefined}
                />
              </section>
              <section className="space-y-3 p-4">
                <h3 className="text-sm font-semibold text-on-surface">類似レコード</h3>
                <SimilarRecords
                  records={buildSimilarRecords(resolvedRecords, resolvedDetailRecord)}
                  onSelect={openRecordDetail}
                />
              </section>
            </>
          )}
        </RecordDetailPanel>
      )}
    </main>
  );
}

function SimilarRecords({
  records,
  onSelect,
}: {
  records: AppRecord[];
  onSelect: (record: AppRecord) => void;
}) {
  if (records.length === 0) {
    return (
      <p className="rounded-lg bg-surface-container p-3 text-sm text-on-surface-variant">
        現在のテーブルに関連レコードは見つかりません。
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {records.map((record) => {
        const description = getRecordDescription(record);
        return (
          <li key={record.id}>
            <button
              type="button"
              onClick={() => onSelect(record)}
              className="min-h-10 w-full rounded-lg bg-surface-container p-3 text-left hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-on-surface-variant">{formatRelativeTime(record.updatedAt)}</span>
                <StatusBadge status={record.status} />
              </span>
              <span className="line-clamp-2 wrap-anywhere font-semibold text-on-surface">{getRecordTitle(record)}</span>
              {description && (
                <span className="line-clamp-2 wrap-anywhere text-sm text-on-surface-variant">{description}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

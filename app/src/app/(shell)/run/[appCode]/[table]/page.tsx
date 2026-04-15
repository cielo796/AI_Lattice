"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  getRuntimeTableMeta,
  listAttachments,
  listComments,
  listRecords,
  uploadAttachment,
} from "@/lib/api/records";
import {
  formatRelativeTime,
  getPriorityVariant,
  getRecordCustomer,
  getRecordDescription,
  getRecordPriority,
  getRecordSentiment,
  getRecordTitle,
} from "@/lib/runtime-records";
import type { RuntimeTableMeta } from "@/types/app";
import type { AppRecord, Attachment, RecordComment } from "@/types/record";

type RecommendedAction = {
  icon: string;
  label: string;
  description: string;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildSummary(record: AppRecord | null) {
  if (!record) {
    return "Select a record to inspect the latest activity.";
  }

  const priority = getRecordPriority(record);
  const customer = getRecordCustomer(record);
  const description = getRecordDescription(record);

  return [
    `${getRecordTitle(record)} is currently ${record.status}.`,
    priority ? `Priority is ${priority}.` : null,
    customer ? `Reporter is ${customer}.` : null,
    description ? `Latest context: ${description}` : null,
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
      label: "Review details",
      description: "Check comments and attachments before updating the record.",
    },
  ];

  const priority = getRecordPriority(record);
  if (priority && getPriorityVariant(priority) === "error") {
    actions.unshift({
      icon: "priority_high",
      label: "Escalate now",
      description: "Critical incidents should be routed to the on-call owner.",
    });
  }

  if (record.status.toLowerCase().includes("waiting")) {
    actions.push({
      icon: "mail",
      label: "Follow up",
      description: "The record is waiting. Send an update to unblock it.",
    });
  }

  const sentiment = getRecordSentiment(record);
  if (typeof sentiment === "number" && sentiment < -0.5) {
    actions.push({
      icon: "sentiment_dissatisfied",
      label: "Customer risk",
      description: "Negative sentiment suggests a proactive reply is useful.",
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
  const appCode = getParam(params.appCode);
  const tableCode = getParam(params.table);

  const [records, setRecords] = useState<AppRecord[]>([]);
  const [comments, setComments] = useState<RecordComment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tableMeta, setTableMeta] = useState<RuntimeTableMeta | null>(null);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [isCreatingRecord, setIsCreatingRecord] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedRecord =
    records.find((record) => record.id === selectedId) ?? null;

  useEffect(() => {
    if (!appCode || !tableCode) {
      setError("Missing runtime route parameters.");
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
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to load runtime records."
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
            : "Failed to load runtime schema."
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

  useEffect(() => {
    if (!appCode || !tableCode || !selectedId) {
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
            : "Failed to load record activity."
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
  }, [appCode, selectedId, tableCode]);

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
          : "Failed to add comment."
      );
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
      setIsCreatingRecord(true);
      const record = await createRecord(appCode, tableCode, input);
      setRecords((current) => [record, ...current]);
      setSelectedId(record.id);
      setComments([]);
      setAttachments([]);
      setIsCreatePanelOpen(false);
      setError(null);
    } catch (nextError) {
      throw (
        nextError instanceof Error
          ? nextError
          : new Error("Failed to create record.")
      );
    } finally {
      setIsCreatingRecord(false);
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
          : "Failed to add attachment."
      );
    } finally {
      setIsUploadingAttachment(false);
    }
  }

  const recommendedActions = buildRecommendedActions(selectedRecord);
  const similarRecords = buildSimilarRecords(records, selectedRecord);

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Runtime" },
          { label: tableMeta?.table.name || tableCode || "Records" },
        ]}
        actions={
          <>
            <Button
              variant="ghost"
              size="md"
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              <Icon name="sync" size="sm" />
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsCreatePanelOpen((current) => !current)}
              disabled={isLoadingMeta}
            >
              <Icon name="add" size="sm" />
              {isLoadingMeta ? "Loading schema..." : "New record"}
            </Button>
          </>
        }
      />

      <main className="flex h-screen pt-16">
        <RecordList
          records={records}
          selectedId={selectedId ?? undefined}
          isLoading={isLoadingRecords}
          onSelect={(record) => setSelectedId(record.id)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {error && (
            <div className="border-b border-error/20 bg-error/10 px-8 py-3 text-sm text-error">
              {error}
            </div>
          )}

          {isCreatePanelOpen && (
            <RecordCreatePanel
              fields={tableMeta?.fields ?? []}
              tableName={tableMeta?.table.name}
              isSubmitting={isCreatingRecord}
              onClose={() => setIsCreatePanelOpen(false)}
              onSubmit={handleCreateRecord}
            />
          )}

          <RecordDetail
            record={selectedRecord}
            comments={comments}
            attachments={attachments}
            isLoadingActivity={isLoadingActivity}
            isSubmittingComment={isSubmittingComment}
            isUploadingAttachment={isUploadingAttachment}
            onAddComment={handleAddComment}
            onAddAttachment={handleAddAttachment}
          />
        </div>

        <AISidebar>
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">
              Runtime summary
            </div>
            <p className="text-xs leading-relaxed text-on-surface">
              {buildSummary(selectedRecord)}
            </p>
          </div>

          <div>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">
              Recommended actions
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
                  No suggested actions yet.
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">
              Similar records
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
                        {record.status}
                      </span>
                    </div>
                    <div className="mb-1 line-clamp-2 text-xs font-bold text-on-surface">
                      {getRecordTitle(record)}
                    </div>
                    <div className="line-clamp-2 text-[10px] text-on-surface-variant">
                      {getRecordDescription(record) || "No description"}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-lg bg-surface-container p-3 text-xs text-on-surface-variant">
                  No related records found in the current table.
                </div>
              )}
            </div>
          </div>
        </AISidebar>
      </main>
    </>
  );
}

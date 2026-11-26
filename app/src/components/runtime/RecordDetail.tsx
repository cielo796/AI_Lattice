"use client";

import Link from "next/link";
import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { RecordActivitySections } from "@/components/runtime/RecordActivitySections";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { cn } from "@/lib/cn";
import { getRuntimeFieldText, spansDetailColumns } from "@/lib/runtime-field-display";
import {
  buildReferenceRecordHref,
  formatDateTime,
  formatFieldKey,
  getRecordData,
  getRecordTitle,
  getRecordFieldValueText,
  getReferenceAppCode,
  getReferenceLookupFieldCodes,
  getReferenceTableCode,
  getReferenceValueIds,
  resolveRecordReferences,
} from "@/lib/runtime-records";
import type {
  ReferenceFieldsByField,
  ReferenceLabelsByField,
  ReferenceRecordsByField,
} from "@/lib/runtime-records";
import type { AppField } from "@/types/app";
import type {
  AppRecord,
  Approval,
  Attachment,
  RecordBackReferenceGroup,
  RecordComment,
} from "@/types/record";

interface RecordDetailProps {
  appCode?: string;
  runtimeBasePath?: string;
  record: AppRecord;
  fieldDefinitions?: AppField[];
  referenceLabelsByField?: ReferenceLabelsByField;
  referenceRecordsByField?: ReferenceRecordsByField;
  referenceFieldsByField?: ReferenceFieldsByField;
  backReferenceGroups?: RecordBackReferenceGroup[];
  isLoadingBackReferences?: boolean;
  comments: RecordComment[];
  attachments: Attachment[];
  approvals?: Approval[];
  isLoadingActivity?: boolean;
  isLoadingApprovals?: boolean;
  isSubmittingComment?: boolean;
  isSubmittingApproval?: boolean;
  isUploadingAttachment?: boolean;
  isDeletingRecord?: boolean;
  deletingAttachmentId?: string | null;
  onAddComment?: (commentText: string) => Promise<void>;
  onSubmitApproval?: () => Promise<void>;
  onAddAttachment?: (file: File) => Promise<void>;
  onEditRecord?: () => void;
  onDeleteRecord?: () => Promise<void>;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
}

function getApprovalStatusLabel(status: Approval["status"]) {
  const labels: Record<Approval["status"], string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    returned: "Returned",
  };

  return labels[status];
}

function getApprovalStatusVariant(
  status: Approval["status"]
): "default" | "success" | "warning" | "error" | "info" | "ai" {
  if (status === "approved") {
    return "success";
  }

  if (status === "rejected") {
    return "error";
  }

  if (status === "returned") {
    return "info";
  }

  return "info";
}

export function RecordDetail({
  appCode,
  runtimeBasePath = "/run",
  record,
  fieldDefinitions = [],
  referenceLabelsByField = {},
  referenceRecordsByField = {},
  referenceFieldsByField = {},
  backReferenceGroups = [],
  isLoadingBackReferences = false,
  comments,
  attachments,
  approvals = [],
  isLoadingActivity = false,
  isLoadingApprovals = false,
  isSubmittingComment = false,
  isSubmittingApproval = false,
  isUploadingAttachment = false,
  isDeletingRecord = false,
  deletingAttachmentId = null,
  onAddComment,
  onSubmitApproval,
  onAddAttachment,
  onEditRecord,
  onDeleteRecord,
  onDeleteAttachment,
}: RecordDetailProps) {
  const [commentText, setCommentText] = useState("");
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const actionsId = useId();
  const actionsButtonRef = useRef<HTMLButtonElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const resolvedRecord = resolveRecordReferences(
    record,
    fieldDefinitions,
    referenceLabelsByField
  );

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

  const data = getRecordData(resolvedRecord);
  const fieldsByCode = new Map(fieldDefinitions.map((field) => [field.code, field]));
  const fieldCodes = new Set([...fieldsByCode.keys(), ...Object.keys(data)]);

  function renderFieldContent(key: string, text: string, fieldDefinition?: AppField) {
    const rawValue = record.data?.[key];

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
                className="inline-flex min-h-10 min-w-0 max-w-full items-center gap-1 rounded-lg bg-primary-container px-3 py-1 font-semibold text-on-primary-container transition-colors hover:bg-primary hover:text-on-primary focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="min-w-0 wrap-anywhere">
                  {referenceLabelsByField[key]?.[referenceRecordId] ?? referenceRecordId}
                </span>
                <Icon name="arrow_outward" size="sm" />
              </Link>
            ))}
          </div>
        );
      }
    }

    return text || <span className="text-on-surface-variant">未入力</span>;
  }

  function renderLookupDetails(fieldDefinition: AppField) {
    const lookupFieldCodes = getReferenceLookupFieldCodes(fieldDefinition);
    const referenceRecordIds = getReferenceValueIds(record.data?.[fieldDefinition.code]);

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
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-tertiary-container">
              {lookupCard.label}
            </div>
            <div className="space-y-1">
              {lookupCard.values.map((lookupValue) => (
                <div
                  key={`${lookupCard.label}-${lookupValue.fieldLabel}`}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="text-on-surface-variant">
                    {lookupValue.fieldLabel}
                  </span>
                  <span className="min-w-0 wrap-anywhere text-right text-on-surface">{lookupValue.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={onEditRecord}
          disabled={!onEditRecord || isDeletingRecord}
          className="focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name="edit" size="sm" />
          レコードを編集
        </Button>
        <div
          className="relative"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setIsActionsOpen(false);
            }
          }}
        >
          <button
            ref={actionsButtonRef}
            type="button"
            aria-label="その他の操作"
            aria-expanded={isActionsOpen}
            aria-controls={actionsId}
            disabled={!onDeleteRecord || isDeletingRecord}
            className="flex h-11 w-11 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            onClick={() => setIsActionsOpen((current) => !current)}
          >
            <Icon name="more_horiz" />
          </button>
          <div id={actionsId} hidden={!isActionsOpen} className="absolute right-0 z-10 min-w-28 rounded-md border border-outline-variant bg-surface p-1 shadow-card">
            <button
              type="button"
              data-testid="delete-record-button"
              className="flex min-h-10 w-full items-center gap-2 rounded px-3 text-sm font-semibold text-error hover:bg-error-container focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => {
                setIsActionsOpen(false);
                actionsButtonRef.current?.focus();
                void onDeleteRecord?.();
              }}
            >
              <Icon name="delete" size="sm" />
              削除
            </button>
          </div>
          {isDeletingRecord && <span role="status" className="sr-only">削除中...</span>}
        </div>
      </div>

      {fieldCodes.size > 0 && (
        <dl className="grid grid-cols-2 gap-3">
          {Array.from(fieldCodes, (key) => {
            const field = fieldsByCode.get(key);
            const text = getRuntimeFieldText(data[key], field?.fieldType);
            return (
              <div key={key} className={cn("min-w-0 rounded-lg border border-outline-variant p-3", spansDetailColumns(text, field?.fieldType) && "col-span-2")}>
                <dt className="mb-1 wrap-anywhere text-xs font-semibold text-on-surface-variant">{formatFieldKey(key, fieldDefinitions)}</dt>
                <dd className="wrap-anywhere whitespace-pre-wrap text-sm text-on-surface">
                  {renderFieldContent(key, text, field)}
                  {field?.fieldType === "master_ref" && renderLookupDetails(field)}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      <div className="space-y-4 [&_a]:min-h-10 [&_a]:rounded [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-primary [&_button]:min-h-10 [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-primary">
        <RecordActivitySections
          appCode={appCode}
          runtimeBasePath={runtimeBasePath}
          backReferenceGroups={backReferenceGroups}
          isLoadingBackReferences={isLoadingBackReferences}
          comments={comments}
          attachments={attachments}
          isLoadingActivity={isLoadingActivity}
          deletingAttachmentId={deletingAttachmentId}
          onDeleteAttachment={onDeleteAttachment}
          commentComposer={(
            <form
              onSubmit={(event) => void handleSubmit(event)}
              className="mt-3 rounded-xl border border-outline-variant bg-surface p-3 shadow-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
            >
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
                aria-label="コメントを追加"
                placeholder="コメントを追加..."
                className="w-full resize-none bg-transparent text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={!onAddAttachment || isUploadingAttachment}
                    className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="添付ファイルを追加"
                  >
                    <Icon name="attach_file" size="sm" />
                  </button>
                  {isUploadingAttachment && (
                    <div className="text-xs text-on-surface-variant">
                      添付ファイルをアップロード中...
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="focus-visible:ring-2 focus-visible:ring-primary"
                  disabled={!commentText.trim() || isSubmittingComment || !onAddComment}
                >
                  {isSubmittingComment ? "送信中..." : "送信"}
                </Button>
              </div>
            </form>
          )}
        />
      </div>

      <div className="space-y-3" data-testid="record-approvals" data-guide="runtime-approval-panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-muted">
            Governance approvals
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onSubmitApproval && (
              <Button
                variant="secondary"
                size="lg"
                className="px-3 focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => void onSubmitApproval()}
                disabled={
                  isSubmittingApproval ||
                  approvals.some((approval) => approval.status === "pending")
                }
              >
                <Icon name="approval" size="sm" />
                {isSubmittingApproval ? "Requesting..." : "Request approval"}
              </Button>
            )}
            {approvals.some((approval) => approval.status === "pending") && (
              <Link
                href="/admin/approvals"
                className="inline-flex min-h-10 items-center gap-1 rounded-md bg-primary-container px-3 py-1.5 text-sm font-semibold text-on-primary-container transition-colors hover:bg-primary hover:text-on-primary focus-visible:ring-2 focus-visible:ring-primary"
              >
                Review queue
                <Icon name="arrow_outward" size="sm" />
              </Link>
            )}
          </div>
        </div>

        {isLoadingApprovals ? (
          <div className="rounded-lg border border-outline-variant bg-surface p-3 text-sm text-on-surface-variant">
            Loading approvals...
          </div>
        ) : approvals.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
            No approvals have been requested for this record yet.
          </div>
        ) : (
          <div className="space-y-2">
            {approvals.map((approval) => (
              <div
                key={approval.id}
                className="rounded-lg border border-outline-variant bg-surface p-3"
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-on-surface">
                      {approval.title}
                    </div>
                    <div className="text-xs text-on-surface-variant">
                      {approval.workflowName ?? "Manual approval"} /{" "}
                      {approval.assignees?.length
                        ? approval.assignees
                            .map(
                              (assignee) =>
                                `${assignee.userName ?? assignee.userId} (${getApprovalStatusLabel(
                                  assignee.status
                                )})`
                            )
                            .join(", ")
                        : approval.approverName ?? approval.approverId}
                    </div>
                  </div>
                  <Badge variant={getApprovalStatusVariant(approval.status)}>
                    {getApprovalStatusLabel(approval.status)}
                  </Badge>
                </div>
                {approval.description && (
                  <div className="mb-2 text-sm text-on-surface-variant">
                    {approval.description}
                  </div>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                  <span>Requested {formatDateTime(approval.createdAt)}</span>
                  {approval.actedAt && (
                    <span>
                      Decided {formatDateTime(approval.actedAt)} by{" "}
                      {approval.actorName ?? approval.actedBy}
                    </span>
                  )}
                </div>
                {approval.commentText && (
                  <div className="mt-2 rounded-md border-l-2 border-outline bg-surface-container-low p-2 text-sm leading-relaxed text-on-surface">
                    {approval.commentText}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { RecordActivitySections } from "@/components/runtime/RecordActivitySections";
import { Avatar } from "@/components/shared/Avatar";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import {
  buildReferenceRecordHref,
  formatDateTime,
  formatFieldKey,
  formatFieldValue,
  formatStatusLabel,
  getDisplayFields,
  getRecordCustomer,
  getRecordDescription,
  getRecordTitle,
  getRecordFieldValueText,
  getReferenceLookupFieldCodes,
  getReferenceTableCode,
  getReferenceValueIds,
  getStatusVariant,
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
  record: AppRecord | null;
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
  isUploadingAttachment?: boolean;
  isDeletingRecord?: boolean;
  deletingAttachmentId?: string | null;
  onAddComment?: (commentText: string) => Promise<void>;
  onAddAttachment?: (file: File) => Promise<void>;
  onEditRecord?: () => void;
  onDeleteRecord?: () => Promise<void>;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
}

function getApprovalStatusLabel(status: Approval["status"]) {
  const labels: Record<Approval["status"], string> = {
    pending: "承認待ち",
    approved: "承認済み",
    rejected: "却下",
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
  isUploadingAttachment = false,
  isDeletingRecord = false,
  deletingAttachmentId = null,
  onAddComment,
  onAddAttachment,
  onEditRecord,
  onDeleteRecord,
  onDeleteAttachment,
}: RecordDetailProps) {
  const [commentText, setCommentText] = useState("");
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const resolvedRecord = resolveRecordReferences(
    record,
    fieldDefinitions,
    referenceLabelsByField
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextComment = commentText.trim();
    if (!nextComment || !resolvedRecord || !onAddComment) {
      return;
    }

    await onAddComment(nextComment);
    setCommentText("");
  }

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !resolvedRecord || !onAddAttachment) {
      return;
    }

    await onAddAttachment(file);
    event.target.value = "";
  }

  if (!resolvedRecord) {
    return (
      <section className="flex flex-1 items-center justify-center bg-surface-container-low">
        <div className="max-w-md rounded-xl border border-dashed border-outline-variant/40 p-8 text-center">
          <div className="mb-2 text-lg font-bold text-white">レコードが選択されていません</div>
          <p className="text-sm text-on-surface-variant">
            一覧からレコードを選択すると、詳細、コメント、添付ファイルを確認できます。
          </p>
        </div>
      </section>
    );
  }

  const description = getRecordDescription(resolvedRecord);
  const customer = getRecordCustomer(resolvedRecord) || "依頼者不明";
  const fields = getDisplayFields(resolvedRecord);

  function renderFieldContent(key: string, value: unknown) {
    const fieldDefinition = fieldDefinitions.find((field) => field.code === key);
    const rawValue = record?.data?.[key];

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
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 font-bold text-primary hover:text-emerald-300"
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
    const referenceRecordIds = getReferenceValueIds(record?.data?.[fieldDefinition.code]);

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
            className="rounded-lg bg-surface-container-high/60 p-3"
          >
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-primary">
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

  return (
    <section className="flex flex-1 flex-col bg-surface-container-low">
      <div className="px-8 py-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={getStatusVariant(resolvedRecord.status)}>
              {formatStatusLabel(resolvedRecord.status)}
            </Badge>
            <span className="text-xs text-on-surface-variant">
              更新: {formatDateTime(resolvedRecord.updatedAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onEditRecord}
              disabled={!onEditRecord || isDeletingRecord}
            >
              <Icon name="edit" size="sm" />
              編集
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              data-testid="delete-record-button"
              onClick={() => void onDeleteRecord?.()}
              disabled={!onDeleteRecord || isDeletingRecord}
            >
              <Icon name="delete" size="sm" />
              {isDeletingRecord ? "削除中..." : "削除"}
            </Button>
          </div>
        </div>
        <h1 className="font-headline text-3xl font-extrabold leading-tight text-white">
          {getRecordTitle(resolvedRecord)}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-6">
        <div className="mb-6 flex gap-4">
          <Avatar name={customer} size="lg" />
          <div className="flex-1">
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-sm font-bold text-white">{customer}</span>
              <span className="text-xs text-on-surface-variant">
                作成: {formatDateTime(resolvedRecord.createdAt)}
              </span>
            </div>
            <div className="rounded-xl bg-surface-container p-4 text-sm leading-relaxed text-on-surface">
              {description || "説明はありません"}
            </div>
          </div>
        </div>

        {fields.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              レコードデータ
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {fields.map(([key, value]) => (
                <div key={key} className="rounded-lg bg-surface-container p-3">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
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

        <div className="mb-6" data-testid="record-approvals">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              承認状況
            </div>
            {approvals.some((approval) => approval.status === "pending") && (
              <Link
                href="/admin/approvals"
                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20"
              >
                承認キューを開く
                <Icon name="arrow_outward" size="sm" />
              </Link>
            )}
          </div>

          {isLoadingApprovals ? (
            <div className="rounded-lg bg-surface-container p-3 text-sm text-on-surface-variant">
              承認情報を読み込み中...
            </div>
          ) : approvals.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
              このレコードにはまだ承認依頼がありません。
            </div>
          ) : (
            <div className="space-y-2">
              {approvals.map((approval) => (
                <div
                  key={approval.id}
                  className="rounded-lg bg-surface-container p-3"
                >
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-on-surface">
                        {approval.title}
                      </div>
                      <div className="text-xs text-on-surface-variant">
                        {approval.workflowName ?? "手動承認"} /{" "}
                        {approval.approverName ?? approval.approverId}
                      </div>
                    </div>
                    <Badge variant={getApprovalStatusVariant(approval.status)}>
                      {getApprovalStatusLabel(approval.status)}
                    </Badge>
                  </div>
                  {approval.description && (
                    <div className="mb-2 text-xs text-on-surface-variant">
                      {approval.description}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-on-surface-variant">
                    <span>依頼日時 {formatDateTime(approval.createdAt)}</span>
                    {approval.actedAt && (
                      <span>
                        {formatDateTime(approval.actedAt)} に{" "}
                        {approval.actorName ?? approval.actedBy} が判断
                      </span>
                    )}
                  </div>
                  {approval.commentText && (
                    <div className="mt-2 rounded bg-surface-container-high/60 p-2 text-xs text-on-surface">
                      {approval.commentText}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

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
        />
      </div>

      <div className="px-8 py-4">
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="rounded-xl bg-surface-container p-3"
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
            placeholder="コメントを追加..."
            className="w-full resize-none bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => attachmentInputRef.current?.click()}
                disabled={!record || !onAddAttachment || isUploadingAttachment}
                className="flex h-8 w-8 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
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
              size="sm"
              disabled={!commentText.trim() || isSubmittingComment || !onAddComment}
            >
              {isSubmittingComment ? "送信中..." : "送信"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

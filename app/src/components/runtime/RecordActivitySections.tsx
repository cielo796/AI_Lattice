"use client";

import Link from "next/link";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { cn } from "@/lib/cn";
import {
  buildReferenceRecordHref,
  formatDateTime,
  getRecordTitle,
} from "@/lib/runtime-records";
import type {
  Attachment,
  RecordBackReferenceGroup,
  RecordComment,
} from "@/types/record";

interface RecordActivitySectionsProps {
  appCode?: string;
  runtimeBasePath: string;
  backReferenceGroups: RecordBackReferenceGroup[];
  isLoadingBackReferences?: boolean;
  comments: RecordComment[];
  attachments: Attachment[];
  isLoadingActivity?: boolean;
  isUploadingAttachment?: boolean;
  deletingAttachmentId?: string | null;
  compact?: boolean;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
}

export function RecordActivitySections({
  appCode,
  runtimeBasePath,
  backReferenceGroups,
  isLoadingBackReferences = false,
  comments,
  attachments,
  isLoadingActivity = false,
  isUploadingAttachment = false,
  deletingAttachmentId = null,
  compact = false,
  onDeleteAttachment,
}: RecordActivitySectionsProps) {
  const sectionClass = compact ? "mb-5" : "mb-6";
  const roundedClass = compact ? "rounded-xl" : "rounded-lg";
  const activityCardClass = cn(
    roundedClass,
    "border border-outline-variant bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
  );
  const emptyClass = cn(
    roundedClass,
    "border-2 border-dashed border-outline-variant bg-surface-container-low p-4 text-center text-sm text-on-surface-variant"
  );

  return (
    <>
      <div className={sectionClass}>
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
          逆参照
        </div>
        {isLoadingBackReferences && backReferenceGroups.length === 0 ? (
          <div
            className={cn(
              roundedClass,
              "border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant"
            )}
          >
            逆参照を読み込んでいます...
          </div>
        ) : backReferenceGroups.length > 0 ? (
          <div className={compact ? "space-y-2" : "space-y-3"}>
            {backReferenceGroups.map((group) => (
              <div
                key={`${group.sourceTableId}:${group.fieldCode}`}
                className={activityCardClass}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-on-surface">
                      {group.sourceTableName}
                    </div>
                    <div className="text-[11px] text-on-surface-variant">
                      {group.fieldName}
                    </div>
                  </div>
                  <Badge variant="info">{group.records.length}</Badge>
                </div>
                <div className="space-y-2">
                  {group.records.map((backReferenceRecord) => (
                    <Link
                      key={backReferenceRecord.id}
                      href={buildReferenceRecordHref(
                        runtimeBasePath,
                        appCode ?? "",
                        group.sourceTableCode,
                        backReferenceRecord.id
                      )}
                      className={cn(
                        "flex items-center justify-between gap-3 border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface transition-colors hover:border-outline hover:bg-surface-container",
                        roundedClass
                      )}
                    >
                      <span className="truncate font-semibold">
                        {getRecordTitle(backReferenceRecord)}
                      </span>
                      <Icon
                        name="arrow_outward"
                        size="sm"
                        className="shrink-0 text-primary"
                      />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={emptyClass}>逆参照はまだありません。</div>
        )}
      </div>

      <div className={sectionClass}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
            添付ファイル
          </div>
          {isUploadingAttachment && (
            <div className="text-[10px] text-on-surface-variant">
              アップロード中...
            </div>
          )}
        </div>
        {isLoadingActivity && attachments.length === 0 ? (
          <div
            className={cn(
              roundedClass,
              "border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant"
            )}
          >
            添付ファイルを読み込んでいます...
          </div>
        ) : attachments.length > 0 ? (
          <div className="space-y-2">
            {attachments.map((attachment) =>
              onDeleteAttachment ? (
                <div
                  key={attachment.id}
                  className={cn(
                    "flex items-center gap-3 border border-outline-variant bg-surface p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
                    roundedClass
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-container">
                    <Icon name="description" size="sm" className="text-[#4573d2]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <a
                      href={attachment.storagePath}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm font-semibold text-on-surface transition-colors hover:text-primary"
                    >
                      {attachment.fileName}
                    </a>
                    <div className="text-[11px] text-on-surface-variant">
                      {(attachment.fileSize / 1024).toFixed(1)} KB /{" "}
                      {attachment.mimeType}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void onDeleteAttachment(attachment.id)}
                    disabled={deletingAttachmentId === attachment.id}
                  >
                    <Icon name="delete" size="sm" />
                    {deletingAttachmentId === attachment.id ? "削除中..." : "削除"}
                  </Button>
                </div>
              ) : (
                <a
                  key={attachment.id}
                  href={attachment.storagePath}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "block border border-outline-variant bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_2px_4px_rgba(15,23,42,0.06)]",
                    roundedClass
                  )}
                >
                  <div className="mb-1 text-sm font-semibold text-on-surface">
                    {attachment.fileName}
                  </div>
                  <div className="text-[11px] text-on-surface-variant">
                    {(attachment.fileSize / 1024).toFixed(1)} KB / {attachment.mimeType}
                  </div>
                </a>
              )
            )}
          </div>
        ) : (
          <div className={emptyClass}>添付ファイルはまだありません。</div>
        )}
      </div>

      <div>
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
          コメント
        </div>
        {isLoadingActivity && comments.length === 0 ? (
          <div
            className={cn(
              roundedClass,
              "border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant"
            )}
          >
            コメントを読み込んでいます...
          </div>
        ) : comments.length > 0 ? (
          <div className={compact ? "space-y-2" : "space-y-3"}>
            {comments.map((comment) => (
              <div key={comment.id} className={activityCardClass}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {comment.isSystem && <Badge variant="info">システム</Badge>}
                    <span className="text-[13px] font-semibold text-on-surface">
                      {comment.isSystem ? "システムイベント" : comment.createdBy}
                    </span>
                  </div>
                  <span
                    className={
                      compact
                        ? "text-[10px] text-on-surface-variant"
                        : "text-[11px] text-on-surface-variant"
                    }
                  >
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
          <div className={emptyClass}>コメントはまだありません。</div>
        )}
      </div>
    </>
  );
}

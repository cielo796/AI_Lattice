"use client";

import { useState, type FormEvent } from "react";
import { Avatar } from "@/components/shared/Avatar";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import {
  formatDateTime,
  getDisplayFields,
  getRecordCustomer,
  getRecordDescription,
  getRecordTitle,
  getStatusVariant,
} from "@/lib/runtime-records";
import type { AppRecord, Attachment, RecordComment } from "@/types/record";

interface RecordDetailProps {
  record: AppRecord | null;
  comments: RecordComment[];
  attachments: Attachment[];
  isLoadingActivity?: boolean;
  isSubmittingComment?: boolean;
  onAddComment?: (commentText: string) => Promise<void>;
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

export function RecordDetail({
  record,
  comments,
  attachments,
  isLoadingActivity = false,
  isSubmittingComment = false,
  onAddComment,
}: RecordDetailProps) {
  const [commentText, setCommentText] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextComment = commentText.trim();
    if (!nextComment || !record || !onAddComment) {
      return;
    }

    await onAddComment(nextComment);
    setCommentText("");
  }

  if (!record) {
    return (
      <section className="flex flex-1 items-center justify-center bg-surface-container-low">
        <div className="max-w-md rounded-xl border border-dashed border-outline-variant/40 p-8 text-center">
          <div className="mb-2 text-lg font-bold text-white">No record selected</div>
          <p className="text-sm text-on-surface-variant">
            Pick a record from the list to inspect its details, comments, and
            attachments.
          </p>
        </div>
      </section>
    );
  }

  const description = getRecordDescription(record);
  const customer = getRecordCustomer(record) || "Unknown reporter";
  const fields = getDisplayFields(record);

  return (
    <section className="flex flex-1 flex-col bg-surface-container-low">
      <div className="px-8 py-6">
        <div className="mb-4 flex items-center gap-3">
          <Badge variant={getStatusVariant(record.status)}>{record.status}</Badge>
          <span className="text-xs text-on-surface-variant">
            Updated {formatDateTime(record.updatedAt)}
          </span>
        </div>
        <h1 className="font-headline text-3xl font-extrabold leading-tight text-white">
          {getRecordTitle(record)}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-6">
        <div className="mb-6 flex gap-4">
          <Avatar name={customer} size="lg" />
          <div className="flex-1">
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-sm font-bold text-white">{customer}</span>
              <span className="text-xs text-on-surface-variant">
                Created {formatDateTime(record.createdAt)}
              </span>
            </div>
            <div className="rounded-xl bg-surface-container p-4 text-sm leading-relaxed text-on-surface">
              {description || "No description"}
            </div>
          </div>
        </div>

        {fields.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Record data
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {fields.map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-lg bg-surface-container p-3"
                >
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {key}
                  </div>
                  <div className="text-sm text-on-surface">
                    {formatFieldValue(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Attachments
          </div>
          {isLoadingActivity && attachments.length === 0 ? (
            <div className="rounded-lg bg-surface-container p-4 text-sm text-on-surface-variant">
              Loading attachments...
            </div>
          ) : attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 rounded-lg bg-surface-container p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon name="description" size="sm" className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-on-surface">
                      {attachment.fileName}
                    </div>
                    <div className="text-[11px] text-on-surface-variant">
                      {(attachment.fileSize / 1024).toFixed(1)} KB · {attachment.mimeType}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
              No attachments yet.
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Comments
          </div>
          {isLoadingActivity && comments.length === 0 ? (
            <div className="rounded-lg bg-surface-container p-4 text-sm text-on-surface-variant">
              Loading comments...
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-xl bg-surface-container p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {comment.isSystem && <Badge variant="info">System</Badge>}
                      <span className="text-xs font-bold text-on-surface">
                        {comment.isSystem ? "System event" : comment.createdBy}
                      </span>
                    </div>
                    <span className="text-[11px] text-on-surface-variant">
                      {formatDateTime(comment.createdAt)}
                    </span>
                  </div>
                  <div className="text-sm leading-relaxed text-on-surface">
                    {comment.commentText}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
              No comments yet.
            </div>
          )}
        </div>
      </div>

      <div className="px-8 py-4">
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="rounded-xl bg-surface-container p-3"
        >
          <textarea
            rows={3}
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder="Add a comment..."
            className="w-full resize-none bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high"
              >
                <Icon name="attach_file" size="sm" />
              </button>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!commentText.trim() || isSubmittingComment || !onAddComment}
            >
              {isSubmittingComment ? "Sending..." : "Send"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

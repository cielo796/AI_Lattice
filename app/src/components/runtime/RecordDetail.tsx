"use client";

import { Icon } from "@/components/shared/Icon";
import { Badge } from "@/components/shared/Badge";
import { Avatar } from "@/components/shared/Avatar";
import { mockComments, mockAttachments } from "@/data/mock-records";
import type { AppRecord } from "@/types/record";

interface RecordDetailProps {
  record: AppRecord;
}

export function RecordDetail({ record }: RecordDetailProps) {
  const data = record.data as {
    ticket_id: string;
    subject: string;
    description: string;
    priority: string;
    customer: string;
  };

  const comments = mockComments.filter((c) => c.recordId === record.id);
  const attachments = mockAttachments.filter((a) => a.recordId === record.id);

  return (
    <section className="flex-1 bg-surface-container-low flex flex-col">
      {/* Header */}
      <div className="px-8 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Badge variant="success">ACTIVE TICKET</Badge>
          <span className="text-xs text-on-surface-variant">
            Created Jan 12, 2024 at 14:02 UTC
          </span>
        </div>
        <h1 className="font-headline text-3xl font-extrabold text-white leading-tight">
          {data.subject}
        </h1>
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-8 pb-6 space-y-6">
        {/* Initial message */}
        <div className="flex gap-4">
          <Avatar name={String(data.customer)} size="lg" />
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-bold text-white text-sm">
                {String(data.customer).split("(")[0].trim()}
              </span>
              <span className="text-xs text-on-surface-variant">(Customer)</span>
            </div>
            <div className="text-sm text-on-surface leading-relaxed">
              Hi Support Team, we are seeing a massive spike across all our instances
              in the EU-West region after the latest cluster update. Can you investigate
              whether this is a connection pool exhaustion issue or a networking
              misconfiguration?
            </div>
            {/* Attachment */}
            {attachments.length > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 bg-surface-container p-2 pr-4 rounded-lg">
                <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                  <Icon name="description" size="sm" className="text-primary" />
                </div>
                <div>
                  <div className="text-xs font-bold text-on-surface">
                    {attachments[0].fileName}
                  </div>
                  <div className="text-[10px] text-on-surface-variant">
                    {(attachments[0].fileSize / 1024).toFixed(1)} KB \u00b7 Plain Text
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* System log */}
        <div className="py-2">
          <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
            System Info
          </div>
          <pre className="bg-surface-container rounded-lg p-3 text-[11px] font-mono text-on-surface-variant leading-relaxed overflow-x-auto">
            {`[SYSTEM_INFO] Cluster: prod-eu-west-01
[LOG_WARN] Found 3,422 occurrences of connection timeout in the last hour.`}
          </pre>
        </div>

        {/* Show system comment if any */}
        {comments.filter((c) => c.isSystem).map((c) => (
          <div key={c.id} className="text-[11px] text-on-surface-variant font-mono pl-16">
            {c.commentText}
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="px-8 py-4">
        <div className="bg-surface-container rounded-xl p-3">
          <textarea
            rows={2}
            placeholder="Type your response or '/' for commands..."
            className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center">
                <Icon name="attach_file" size="sm" />
              </button>
              <button className="w-8 h-8 rounded hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center">
                <Icon name="mood" size="sm" />
              </button>
              <button className="w-8 h-8 rounded hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center">
                <Icon name="alternate_email" size="sm" />
              </button>
            </div>
            <button className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center hover:bg-emerald-600">
              <Icon name="send" size="sm" className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

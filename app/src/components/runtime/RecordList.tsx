"use client";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/shared/Icon";
import { Badge } from "@/components/shared/Badge";
import type { AppRecord } from "@/types/record";

interface RecordListProps {
  records: AppRecord[];
  selectedId?: string;
  onSelect: (record: AppRecord) => void;
}

const priorityVariant: { [key: string]: "error" | "warning" | "info" | "default" } = {
  Critical: "error",
  High: "warning",
  Medium: "info",
  Low: "default",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export function RecordList({ records, selectedId, onSelect }: RecordListProps) {
  return (
    <div className="w-80 shrink-0 bg-surface-container-low flex flex-col">
      <div className="p-4">
        <div className="relative">
          <Icon
            name="search"
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            placeholder="Search records..."
            className="w-full pl-9 pr-4 py-2 bg-surface-container rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
      <div className="px-4 pb-2">
        <div className="text-xs font-bold text-on-surface-variant tracking-widest uppercase">
          Tickets ({records.length})
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-6">
        {records.map((rec) => {
          const data = rec.data as { [key: string]: string };
          const isSelected = rec.id === selectedId;
          return (
            <button
              key={rec.id}
              onClick={() => onSelect(rec)}
              className={cn(
                "w-full text-left p-3 rounded-lg transition-colors",
                isSelected
                  ? "bg-surface-container-high"
                  : "hover:bg-surface-container"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold text-on-surface-variant">
                  {data.ticket_id}
                </span>
                <Badge variant={priorityVariant[data.priority] ?? "default"} className="text-[9px]">
                  {data.priority}
                </Badge>
              </div>
              <div
                className={cn(
                  "text-sm font-bold line-clamp-2 mb-1",
                  isSelected ? "text-primary" : "text-on-surface"
                )}
              >
                {data.subject}
              </div>
              <div className="text-[11px] text-on-surface-variant line-clamp-2 mb-2">
                {data.description}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-on-surface-variant">
                <Icon name="schedule" size="sm" className="text-[10px]" />
                {timeAgo(rec.updatedAt)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

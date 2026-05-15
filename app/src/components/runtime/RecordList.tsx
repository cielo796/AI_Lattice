"use client";

import { useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Icon } from "@/components/shared/Icon";
import { cn } from "@/lib/cn";
import {
  formatRelativeTime,
  formatPriorityLabel,
  formatStatusLabel,
  getPriorityVariant,
  getRecordDescription,
  getRecordIdentifier,
  getRecordPriority,
  getRecordTitle,
  getStatusVariant,
} from "@/lib/runtime-records";
import type { AppRecord } from "@/types/record";

interface RecordListProps {
  records: AppRecord[];
  selectedId?: string;
  isLoading?: boolean;
  onSelect: (record: AppRecord) => void;
}

export function RecordList({
  records,
  selectedId,
  isLoading = false,
  onSelect,
}: RecordListProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredRecords = records.filter((record) => {
    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      getRecordIdentifier(record),
      getRecordTitle(record),
      getRecordDescription(record),
      getRecordPriority(record),
      record.status,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
  const emptyMessage = normalizedQuery
    ? "検索条件に一致するレコードはありません。"
    : "まだレコードがありません。新規レコードから作成できます。";

  return (
    <div className="flex w-full shrink-0 flex-col border-b border-outline-variant bg-surface xl:w-80 xl:border-b-0 xl:border-r">
      <div className="border-b border-outline-variant p-3">
        <div className="relative">
          <Icon
            name="search"
            size="sm"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="レコードを検索..."
            className="w-full rounded-md border border-outline bg-surface py-1.5 pl-8 pr-3 text-[13px] text-on-surface placeholder:text-on-surface-muted hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
          レコード
        </div>
        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
          {filteredRecords.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-6">
        {isLoading && (
          <div className="rounded-lg bg-surface-container p-4 text-sm text-on-surface-variant">
            レコードを読み込んでいます...
          </div>
        )}

        {!isLoading && filteredRecords.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low p-6 text-center text-[13px] text-on-surface-variant">
            {emptyMessage}
          </div>
        )}

        <div className="space-y-0.5">
          {filteredRecords.map((record) => {
            const isSelected = record.id === selectedId;
            const priority = getRecordPriority(record);

            return (
              <button
                key={record.id}
                type="button"
                data-testid={`record-row-${record.id}`}
                data-draggable
                onClick={() => onSelect(record)}
                className={cn(
                  "group relative w-full rounded-lg p-2.5 text-left transition-all",
                  isSelected
                    ? "bg-primary-container/60"
                    : "hover:bg-surface-container"
                )}
              >
                {isSelected && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <div className="mb-1 flex items-center gap-2">
                  <span className="drag-handle material-symbols-outlined text-[16px] text-on-surface-muted">
                    drag_indicator
                  </span>
                  <span className="font-mono text-[10.5px] font-semibold text-on-surface-muted">
                    {getRecordIdentifier(record)}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <Badge
                      variant={getStatusVariant(record.status)}
                      className="!text-[10px]"
                    >
                      {formatStatusLabel(record.status)}
                    </Badge>
                    {priority && (
                      <Badge
                        variant={getPriorityVariant(priority)}
                        className="!text-[10px]"
                      >
                        {formatPriorityLabel(priority)}
                      </Badge>
                    )}
                  </div>
                </div>

                <div
                  className={cn(
                    "mb-1 line-clamp-2 pl-6 text-[13.5px] font-semibold leading-snug tracking-tight",
                    isSelected ? "text-on-primary-container" : "text-on-surface"
                  )}
                >
                  {getRecordTitle(record)}
                </div>

                <div className="mb-1.5 line-clamp-2 pl-6 text-[11.5px] leading-relaxed text-on-surface-variant">
                  {getRecordDescription(record) || "説明はありません"}
                </div>

                <div className="flex items-center gap-1 pl-6 text-[10.5px] text-on-surface-muted">
                  <Icon name="schedule" size="sm" className="text-[11px]" />
                  {formatRelativeTime(record.updatedAt)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

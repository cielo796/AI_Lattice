"use client";

import { useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Icon } from "@/components/shared/Icon";
import { cn } from "@/lib/cn";
import {
  formatRelativeTime,
  getPriorityVariant,
  getRecordDescription,
  getRecordIdentifier,
  getRecordPriority,
  getRecordTitle,
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

  return (
    <div className="flex w-80 shrink-0 flex-col bg-surface-container-low">
      <div className="p-4">
        <div className="relative">
          <Icon
            name="search"
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search records..."
            className="w-full rounded-lg bg-surface-container py-2 pl-9 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="px-4 pb-2">
        <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Records · {filteredRecords.length}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {isLoading && (
          <div className="rounded-lg bg-surface-container p-4 text-sm text-on-surface-variant">
            Loading records...
          </div>
        )}

        {!isLoading && filteredRecords.length === 0 && (
          <div className="rounded-lg border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
            No records found.
          </div>
        )}

        <div className="space-y-1">
          {filteredRecords.map((record) => {
            const isSelected = record.id === selectedId;
            const priority = getRecordPriority(record);

            return (
              <button
                key={record.id}
                type="button"
                onClick={() => onSelect(record)}
                className={cn(
                  "w-full rounded-lg p-3 text-left transition-colors",
                  isSelected
                    ? "bg-surface-container-high"
                    : "hover:bg-surface-container"
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold text-on-surface-variant">
                    {getRecordIdentifier(record)}
                  </span>
                  {priority && (
                    <Badge
                      variant={getPriorityVariant(priority)}
                      className="text-[9px]"
                    >
                      {priority}
                    </Badge>
                  )}
                </div>

                <div
                  className={cn(
                    "mb-1 line-clamp-2 text-sm font-bold",
                    isSelected ? "text-primary" : "text-on-surface"
                  )}
                >
                  {getRecordTitle(record)}
                </div>

                <div className="mb-2 line-clamp-2 text-[11px] text-on-surface-variant">
                  {getRecordDescription(record) || "No description"}
                </div>

                <div className="flex items-center gap-1 text-[10px] text-on-surface-variant">
                  <Icon name="schedule" size="sm" className="text-[10px]" />
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

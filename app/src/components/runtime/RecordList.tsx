"use client";

import { useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Icon } from "@/components/shared/Icon";
import { cn } from "@/lib/cn";
import {
  formatFieldKey,
  formatFieldValue,
  formatRelativeTime,
  formatPriorityLabel,
  formatStatusLabel,
  getRecordData,
  getPriorityVariant,
  getRecordDescription,
  getRecordIdentifier,
  getRecordPriority,
  getRecordTitle,
  getStatusVariant,
} from "@/lib/runtime-records";
import type { AppField, AppView } from "@/types/app";
import type { AppRecord } from "@/types/record";

interface RecordListProps {
  records: AppRecord[];
  fields?: AppField[];
  views?: AppView[];
  activeViewId?: string;
  selectedId?: string;
  isLoading?: boolean;
  onViewChange?: (viewId: string) => void;
  onSelect: (record: AppRecord) => void;
}

type ViewFilter = {
  fieldCode: string;
  operator: "equals" | "contains" | "not_empty";
  value?: string;
};

function getViewColumns(view: AppView | undefined, fields: AppField[]) {
  const columns = view?.settingsJson?.columns;
  const fieldCodes = new Set(fields.map((field) => field.code));
  const configuredColumns = Array.isArray(columns)
    ? columns.filter(
        (item): item is string => typeof item === "string" && fieldCodes.has(item)
      )
    : [];

  return configuredColumns.length > 0
    ? configuredColumns
    : fields.slice(0, 3).map((field) => field.code);
}

function getViewSort(view: AppView | undefined) {
  const sort = view?.settingsJson?.sort;

  if (!sort || typeof sort !== "object" || Array.isArray(sort)) {
    return null;
  }

  const sortSettings = sort as Record<string, unknown>;
  const fieldCode =
    typeof sortSettings.fieldCode === "string" ? sortSettings.fieldCode : "";
  if (!fieldCode) {
    return null;
  }

  return {
    fieldCode,
    direction: sortSettings.direction === "asc" ? "asc" : "desc",
  };
}

function getViewFilters(view: AppView | undefined): ViewFilter[] {
  const filters = view?.settingsJson?.filters;

  if (!Array.isArray(filters)) {
    return [];
  }

  return filters.reduce<ViewFilter[]>((normalizedFilters, filter) => {
    if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
      return normalizedFilters;
    }

    const rawFilter = filter as Record<string, unknown>;
    const fieldCode =
      typeof rawFilter.fieldCode === "string" ? rawFilter.fieldCode : "";

    if (!fieldCode) {
      return normalizedFilters;
    }

    const operator: ViewFilter["operator"] =
      rawFilter.operator === "equals" || rawFilter.operator === "not_empty"
        ? rawFilter.operator
        : "contains";
    const value =
      typeof rawFilter.value === "string" ? rawFilter.value.trim() : "";

    normalizedFilters.push({ fieldCode, operator, value });
    return normalizedFilters;
  }, []);
}

function getComparableValue(record: AppRecord, fieldCode: string) {
  const value = getRecordData(record)[fieldCode];

  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
}

function filterRecordsByView(records: AppRecord[], filters: ViewFilter[]) {
  if (filters.length === 0) {
    return records;
  }

  return records.filter((record) =>
    filters.every((filter) => {
      const value = getComparableValue(record, filter.fieldCode);
      const text = String(value).toLowerCase();
      const expected = (filter.value ?? "").toLowerCase();

      if (filter.operator === "not_empty") {
        return text.trim().length > 0;
      }

      if (filter.operator === "equals") {
        return text === expected;
      }

      return expected ? text.includes(expected) : true;
    })
  );
}

function sortRecordsByView(records: AppRecord[], view: AppView | undefined) {
  const sort = getViewSort(view);

  if (!sort) {
    return records;
  }

  return [...records].sort((left, right) => {
    const leftValue = getComparableValue(left, sort.fieldCode);
    const rightValue = getComparableValue(right, sort.fieldCode);
    const direction = sort.direction === "asc" ? 1 : -1;

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction;
    }

    return String(leftValue).localeCompare(String(rightValue), "ja") * direction;
  });
}

export function RecordList({
  records,
  fields = [],
  views = [],
  activeViewId,
  selectedId,
  isLoading = false,
  onViewChange,
  onSelect,
}: RecordListProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const activeView =
    views.find((view) => view.id === activeViewId) ?? views[0] ?? undefined;
  const visibleColumnCodes = getViewColumns(activeView, fields);
  const viewRecords = sortRecordsByView(
    filterRecordsByView(records, getViewFilters(activeView)),
    activeView
  );

  const filteredRecords = viewRecords.filter((record) => {
    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      getRecordIdentifier(record),
      getRecordTitle(record),
      getRecordDescription(record),
      getRecordPriority(record),
      record.status,
      ...visibleColumnCodes.map((fieldCode) =>
        formatFieldValue(getRecordData(record)[fieldCode])
      ),
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
        {views.length > 0 && (
          <div className="mt-2 flex gap-1 overflow-x-auto">
            {views.map((view) => {
              const isActive = view.id === activeView?.id;

              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => onViewChange?.(view.id)}
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                    isActive
                      ? "bg-primary-container text-on-primary-container"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  )}
                >
                  {view.name}
                </button>
              );
            })}
          </div>
        )}
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
            const recordData = getRecordData(record);
            const visibleFields = visibleColumnCodes
              .filter(
                (fieldCode) =>
                  !["subject", "title", "name", "description", "summary", "details"].includes(
                    fieldCode
                  )
              )
              .map((fieldCode) => ({
                fieldCode,
                value: recordData[fieldCode],
              }))
              .filter(
                (item) =>
                  item.value !== undefined &&
                  item.value !== null &&
                  String(item.value).trim().length > 0
              )
              .slice(0, 3);

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

                {visibleFields.length > 0 && (
                  <div className="mb-1.5 space-y-0.5 pl-6">
                    {visibleFields.map((field) => (
                      <div
                        key={field.fieldCode}
                        className="grid grid-cols-[72px_minmax(0,1fr)] gap-1 text-[10.5px]"
                      >
                        <span className="truncate text-on-surface-muted">
                          {formatFieldKey(field.fieldCode, fields)}
                        </span>
                        <span className="truncate text-on-surface-variant">
                          {formatFieldValue(field.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

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

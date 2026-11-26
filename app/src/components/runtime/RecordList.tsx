"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RecordTable } from "@/components/runtime/RecordTable";
import { PaginatedRecords } from "@/components/runtime/PaginatedRecords";
import { Icon } from "@/components/shared/Icon";
import { cn } from "@/lib/cn";
import {
  formatFieldKey,
  formatFieldValue,
  formatRelativeTime,
  formatStatusLabel,
  getRecordIdentifier,
  getRecordTitle,
  getStatusVariant,
} from "@/lib/runtime-records";
import {
  getChartBuckets,
  getDateFieldCode,
  getFieldDisplayLabel,
  getGroupFieldCode,
  getMetricFieldCode,
  getNumericMetricValues,
  getVisibleFields,
  groupRecordsByDate,
  groupRecordsByField,
} from "@/lib/runtime-views";
import type { AppField, AppView, AppViewType } from "@/types/app";
import type { AppRecord } from "@/types/record";

interface RecordListProps {
  filteredRecords: AppRecord[];
  fields: AppField[];
  activeView?: AppView;
  visibleColumnCodes: string[];
  pageResetKey: string;
  hasQuery: boolean;
  selectedId?: string;
  detailOpen: boolean;
  isLoading?: boolean;
  onSelect: (record: AppRecord) => void;
  onNavigate: (record: AppRecord) => void;
}

interface RecordCardProps {
  record: AppRecord;
  fields: AppField[];
  visibleColumnCodes: string[];
  selectedId?: string;
  onSelect: (record: AppRecord) => void;
}

const VIEW_TYPE_ICONS: Record<AppViewType, string> = {
  list: "view_list",
  kanban: "view_kanban",
  calendar: "calendar_month",
  chart: "insert_chart",
  summary: "speed",
};

const numberFormatter = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 1,
});

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatDateGroupLabel(dateKey: string) {
  if (dateKey === "日付なし") {
    return dateKey;
  }

  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function formatMonthLabel(monthKey: string) {
  const date = new Date(`${monthKey}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return monthKey;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCurrentMonthKey() {
  const today = new Date();
  return getDateKey(new Date(today.getFullYear(), today.getMonth(), 1)).slice(0, 7);
}

function addMonths(monthKey: string, amount: number) {
  const date = new Date(`${monthKey}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return getCurrentMonthKey();
  }

  date.setMonth(date.getMonth() + amount);
  return getDateKey(date).slice(0, 7);
}

function getCalendarDays(monthKey: string, recordsByDate: Map<string, AppRecord[]>) {
  const baseDate = new Date(`${monthKey}-01T00:00:00`);
  const normalizedBaseDate = Number.isNaN(baseDate.getTime())
    ? new Date(`${getCurrentMonthKey()}-01T00:00:00`)
    : baseDate;
  const year = normalizedBaseDate.getFullYear();
  const month = normalizedBaseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const leadingDays = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  const todayKey = getDateKey(new Date());

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(year, month, index - leadingDays + 1);
    const dateKey = getDateKey(date);

    return {
      key: dateKey,
      date,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: dateKey === todayKey,
      records: recordsByDate.get(dateKey) ?? [],
    };
  });
}

function RecordCard({
  record,
  fields,
  visibleColumnCodes,
  selectedId,
  onSelect,
}: RecordCardProps) {
  const isSelected = record.id === selectedId;
  const visibleFields = getVisibleFields(
    record,
    visibleColumnCodes,
    fields,
    2
  );

  return (
    <button
      type="button"
      data-testid={`record-row-${record.id}`}
      data-guide="runtime-record-card"
      data-draggable
      onClick={() => onSelect(record)}
      className={cn(
        "group relative w-full rounded-lg border border-outline-variant p-2.5 text-left transition-colors",
        isSelected ? "bg-primary-container/60" : "bg-surface hover:bg-surface-container"
      )}
    >
      {isSelected && (
        <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <div className="mb-1 flex items-center gap-2">
        <Icon name="drag_indicator" size="sm" className="drag-handle text-on-surface-muted" />
        <span className="min-w-0 truncate font-mono text-xs font-semibold text-on-surface-muted">
          {getRecordIdentifier(record)}
        </span>
        <StatusBadge status={record.status} className="ml-auto shrink-0" />
      </div>

      <div
        className={cn(
          "mb-1 line-clamp-2 pl-6 text-sm font-semibold leading-snug tracking-tight",
          isSelected ? "text-on-primary-container" : "text-on-surface"
        )}
      >
        {getRecordTitle(record)}
      </div>

      {visibleFields.length > 0 && (
        <div className="mb-1.5 space-y-0.5 pl-6">
          {visibleFields.map((field) => (
            <div
              key={field.fieldCode}
              className="grid grid-cols-[72px_minmax(0,1fr)] gap-1 text-sm"
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

      <div className="flex items-center gap-1 pl-6 text-xs text-on-surface-muted">
        <Icon name="schedule" size="sm" className="text-[11px]" />
        {formatRelativeTime(record.updatedAt)}
      </div>
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low p-6 text-center text-sm text-on-surface-variant">
      {message}
    </div>
  );
}

export function RecordList({
  filteredRecords,
  fields,
  activeView,
  visibleColumnCodes,
  pageResetKey,
  hasQuery,
  selectedId,
  detailOpen,
  isLoading = false,
  onSelect,
  onNavigate,
}: RecordListProps) {
  const [calendarMonthKey, setCalendarMonthKey] = useState<string | null>(null);
  const activeViewType = activeView?.viewType ?? "list";
  const emptyMessage = hasQuery
    ? "検索条件に一致するレコードはありません。"
    : "まだレコードがありません。";
  const isListView = activeViewType === "list";

  const groupFieldCode = getGroupFieldCode(activeView, fields);
  const dateFieldCode = getDateFieldCode(activeView, fields);
  const metricFieldCode = getMetricFieldCode(activeView, fields);
  const metricLabel = metricFieldCode
    ? getFieldDisplayLabel(metricFieldCode, fields)
    : "件数";
  const kanbanGroups = useMemo(
    () => activeViewType === "kanban"
      ? groupRecordsByField(filteredRecords, groupFieldCode, fields)
      : [],
    [activeViewType, filteredRecords, groupFieldCode, fields]
  );
  const calendarGroups = useMemo(
    () => activeViewType === "calendar"
      ? groupRecordsByDate(filteredRecords, dateFieldCode)
      : [],
    [activeViewType, filteredRecords, dateFieldCode]
  );
  const recordsByDate = new Map(
    calendarGroups.map((group) => [group.key, group.records] as const)
  );
  const firstCalendarMonthKey =
    calendarGroups.find((group) => group.key !== "日付なし")?.key.slice(0, 7) ??
    getCurrentMonthKey();
  const displayedCalendarMonthKey = calendarMonthKey ?? firstCalendarMonthKey;
  const calendarDays = activeViewType === "calendar"
    ? getCalendarDays(displayedCalendarMonthKey, recordsByDate)
    : [];
  const undatedCalendarGroup = calendarGroups.find((group) => group.key === "日付なし");
  const chartBuckets = useMemo(
    () => activeViewType === "chart"
      ? getChartBuckets(filteredRecords, fields, activeView)
      : [],
    [activeViewType, filteredRecords, fields, activeView]
  );
  const metricValues = useMemo(
    () => activeViewType === "summary"
      ? getNumericMetricValues(filteredRecords, metricFieldCode)
      : [],
    [activeViewType, filteredRecords, metricFieldCode]
  );
  const metricTotal = metricValues.reduce((total, value) => total + value, 0);
  const metricAverage =
    metricValues.length > 0 ? metricTotal / metricValues.length : 0;
  const doneCount = useMemo(
    () => activeViewType === "summary"
      ? filteredRecords.filter((record) => getStatusVariant(record.status) === "success").length
      : 0,
    [activeViewType, filteredRecords]
  );

  return (
    <div className="min-w-0 bg-surface" data-guide="runtime-record-list">
      {isLoading && (
        <div className="mx-4 my-3 rounded-lg bg-surface-container p-4 text-sm text-on-surface-variant">
          レコードを読み込んでいます...
        </div>
      )}

      {!isLoading && filteredRecords.length === 0 && (
        <div className="p-4" data-guide="runtime-empty-records">
          <EmptyState message={emptyMessage} />
        </div>
      )}

      {isListView && filteredRecords.length > 0 && (
        <RecordTable
          key={pageResetKey}
          records={filteredRecords}
          fields={fields}
          visibleColumnCodes={visibleColumnCodes}
          selectedId={selectedId}
          detailOpen={detailOpen}
          onSelect={onSelect}
          onNavigate={onNavigate}
        />
      )}

      <div
        hidden={isListView || filteredRecords.length === 0}
        className="min-w-0 p-4 [&_button]:min-h-10 [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-primary"
      >
        <div className="mb-3 flex items-center gap-2 text-xs text-on-surface-variant">
          <Icon name={VIEW_TYPE_ICONS[activeViewType]} size="sm" className="text-primary" />
          {activeViewType === "calendar"
            ? getFieldDisplayLabel(dateFieldCode, fields) + " 別"
            : activeViewType === "summary"
              ? metricLabel
              : getFieldDisplayLabel(groupFieldCode, fields) + " 別"}
        </div>
        {filteredRecords.length > 0 && activeViewType === "kanban" && (
          <div
            className="flex h-full min-h-[28rem] gap-3 overflow-x-auto pb-4"
            data-testid="runtime-kanban-view"
          >
            {kanbanGroups.map((group) => (
              <section
                key={group.key}
                className="flex w-64 shrink-0 flex-col rounded-lg border border-outline-variant bg-surface-container-low"
              >
                <div className="flex items-center justify-between gap-2 border-b border-outline-variant px-3 py-2">
                  <div className="min-w-0 truncate text-[12px] font-semibold text-on-surface">
                    {group.label}
                  </div>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
                    {group.records.length}
                  </span>
                </div>
                <div className="space-y-2 overflow-y-auto p-2">
                  <PaginatedRecords
                    key={`${pageResetKey}:${group.key}`}
                    records={group.records}
                    label={`${group.label}のレコード`}
                    renderRecord={(record) => <RecordCard record={record} fields={fields} visibleColumnCodes={visibleColumnCodes} selectedId={selectedId} onSelect={onSelect} />}
                  />
                </div>
              </section>
            ))}
          </div>
        )}

        {filteredRecords.length > 0 && activeViewType === "calendar" && (
          <div className="space-y-3" data-testid="runtime-calendar-view">
            <div className="rounded-lg border border-outline-variant bg-surface-container-low">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-on-surface">
                    {formatMonthLabel(displayedCalendarMonthKey)}
                  </div>
                  <div className="text-[10.5px] text-on-surface-variant">
                    {getFieldDisplayLabel(dateFieldCode, fields)} を月間表示
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonthKey((current) =>
                        addMonths(current ?? displayedCalendarMonthKey, -1)
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-outline-variant bg-surface text-on-surface-variant transition-colors hover:bg-surface-container"
                    aria-label="前月"
                  >
                    <Icon name="chevron_left" size="sm" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarMonthKey(firstCalendarMonthKey)}
                    className="h-8 rounded-md border border-outline-variant bg-surface px-3 text-[11px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
                  >
                    初期月
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonthKey((current) =>
                        addMonths(current ?? displayedCalendarMonthKey, 1)
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-outline-variant bg-surface text-on-surface-variant transition-colors hover:bg-surface-container"
                    aria-label="翌月"
                  >
                    <Icon name="chevron_right" size="sm" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto p-2">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-7 border-b border-outline-variant text-center text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                    {["日", "月", "火", "水", "木", "金", "土"].map((weekday) => (
                      <div key={weekday} className="py-2">
                        {weekday}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {calendarDays.map((day) => (
                      <div
                        key={day.key}
                        className={cn(
                          "min-h-32 border-b border-r border-outline-variant bg-surface p-2",
                          !day.inMonth && "bg-surface-container-low text-on-surface-muted",
                          day.isToday && "bg-primary-container/30"
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                              day.isToday
                                ? "bg-primary text-on-primary"
                                : "text-on-surface-variant"
                            )}
                          >
                            {day.day}
                          </span>
                          {day.records.length > 0 && (
                            <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-semibold text-on-surface-variant">
                              {day.records.length}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          {day.records.slice(0, 3).map((record) => {
                            const isSelected = record.id === selectedId;

                            return (
                              <button
                                key={record.id}
                                type="button"
                                onClick={() => onSelect(record)}
                                className={cn(
                                  "w-full rounded-md border px-2 py-1 text-left text-[10.5px] leading-snug transition-colors",
                                  isSelected
                                    ? "border-primary bg-primary-container text-on-primary-container"
                                    : "border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container"
                                )}
                              >
                                <span className="block truncate font-semibold">
                                  {getRecordTitle(record)}
                                </span>
                                <span className="mt-0.5 block truncate text-[9.5px] text-on-surface-variant">
                                  {formatStatusLabel(record.status)}
                                </span>
                              </button>
                            );
                          })}
                          {day.records.length > 3 && (
                            <div className="rounded-md bg-surface-container-high px-2 py-1 text-[10px] font-semibold text-on-surface-variant">
                              +{day.records.length - 3} 件
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {undatedCalendarGroup && undatedCalendarGroup.records.length > 0 && (
              <section className="rounded-lg border border-outline-variant bg-surface-container-low">
                <div className="flex items-center justify-between gap-2 border-b border-outline-variant px-3 py-2">
                  <div className="truncate text-[12px] font-semibold text-on-surface">
                    {formatDateGroupLabel(undatedCalendarGroup.label)}
                  </div>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
                    {undatedCalendarGroup.records.length}
                  </span>
                </div>
                <div className="space-y-2 p-2">
                  <PaginatedRecords
                    key={pageResetKey}
                    records={undatedCalendarGroup.records}
                    label="日付なしのレコード"
                    renderRecord={(record) => <RecordCard record={record} fields={fields} visibleColumnCodes={visibleColumnCodes} selectedId={selectedId} onSelect={onSelect} />}
                  />
                </div>
              </section>
            )}
          </div>
        )}

        {filteredRecords.length > 0 && activeViewType === "chart" && (
          <div className="space-y-4" data-testid="runtime-chart-view">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                  レコード
                </div>
                <div className="mt-2 text-2xl font-bold text-on-surface">
                  {filteredRecords.length}
                </div>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-3 md:col-span-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                  集計軸
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-on-surface">
                  <Icon name="bar_chart" size="sm" className="text-primary" />
                  {getFieldDisplayLabel(groupFieldCode, fields)} / {metricLabel}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {chartBuckets.map((bucket) => (
                <button
                  key={bucket.key}
                  type="button"
                  onClick={() => onSelect(bucket.records[0])}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-left transition-colors hover:bg-surface-container"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[12px] font-semibold text-on-surface">
                      {bucket.label}
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-on-surface-variant">
                      {metricFieldCode
                        ? formatNumber(bucket.value)
                        : `${bucket.records.length} 件`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-container-high">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${bucket.percent}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {filteredRecords.length > 0 && activeViewType === "summary" && (
          <div className="space-y-4" data-testid="runtime-summary-view">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                  総レコード
                </div>
                <div className="mt-2 text-3xl font-bold text-on-surface">
                  {filteredRecords.length}
                </div>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                  完了
                </div>
                <div className="mt-2 text-3xl font-bold text-on-surface">
                  {doneCount}
                </div>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                  {metricLabel} 合計
                </div>
                <div className="mt-2 text-3xl font-bold text-on-surface">
                  {metricFieldCode ? formatNumber(metricTotal) : "-"}
                </div>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                  {metricLabel} 平均
                </div>
                <div className="mt-2 text-3xl font-bold text-on-surface">
                  {metricFieldCode ? formatNumber(metricAverage) : "-"}
                </div>
              </div>
            </div>

            <section className="rounded-lg border border-outline-variant bg-surface-container-low">
              <div className="border-b border-outline-variant px-3 py-2 text-[12px] font-semibold text-on-surface">
                最近更新されたレコード
              </div>
              <div className="space-y-2 p-2">
                {filteredRecords.slice(0, 6).map((record) => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    fields={fields}
                    visibleColumnCodes={visibleColumnCodes}
                    selectedId={selectedId}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

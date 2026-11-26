"use client";

import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/cn";
import { getRuntimeFieldText } from "@/lib/runtime-field-display";
import { getNextRowIndex, isRowNavigationKey } from "@/lib/runtime-keyboard";
import { getRecordPage, RECORD_PAGE_SIZE } from "@/lib/runtime-pagination";
import {
  formatRelativeTime,
  getRecordData,
  getRecordDisplayNumber,
  getRecordTitle,
} from "@/lib/runtime-records";
import type { AppField } from "@/types/app";
import type { AppRecord } from "@/types/record";

interface RecordTableProps {
  records: AppRecord[];
  fields: AppField[];
  visibleColumnCodes: string[];
  selectedId?: string;
  detailOpen: boolean;
  onSelect: (record: AppRecord) => void;
  onNavigate: (record: AppRecord) => void;
}

export function RecordTable({
  records,
  fields,
  visibleColumnCodes,
  selectedId,
  detailOpen,
  onSelect,
  onNavigate,
}: RecordTableProps) {
  const selectedRecordIndex = records.findIndex((record) => record.id === selectedId);
  const selectedPage = Math.floor(selectedRecordIndex / RECORD_PAGE_SIZE);
  const [pagination, setPagination] = useState({
    selectedId,
    requestedPage: Math.max(0, selectedPage),
  });
  if (pagination.selectedId !== selectedId) {
    setPagination({ selectedId, requestedPage: selectedPage < 0 ? pagination.requestedPage : selectedPage });
  }
  const page = getRecordPage(records, pagination.requestedPage);
  const selectedIndex = page.records.findIndex((record) => record.id === selectedId);
  const fieldsByCode = new Map(fields.map((field) => [field.code, field]));
  const columns = Array.from(new Set(visibleColumnCodes), (code) => fieldsByCode.get(code))
    .filter((field) => field !== undefined);

  function goToPage(requestedPage: number) {
    setPagination({ selectedId, requestedPage });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-record-row-trigger]");
    if (!target) {
      return;
    }

    const focusedIndex = page.records.findIndex((record) => record.id === target.dataset.recordRowTrigger);
    if (event.key === "Enter" && detailOpen && selectedIndex === focusedIndex) {
      event.preventDefault();
    }
    if (!isRowNavigationKey(event.key)) {
      return;
    }

    event.preventDefault();
    const nextIndex = getNextRowIndex(event.key, focusedIndex, page.records.length);
    if (nextIndex === null) {
      return;
    }
    const record = page.records[nextIndex];
    if (record.id !== selectedId) {
      onNavigate(record);
    }
    event.currentTarget
      .querySelector<HTMLButtonElement>(`button[data-record-row-trigger="${CSS.escape(record.id)}"]`)
      ?.focus();
  }

  return (
    <div data-testid="runtime-list-view">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm" aria-label="レコード一覧" onKeyDown={handleKeyDown}>
          <thead className="bg-surface-container-low text-on-surface-variant">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">レコード</th>
              {columns.map((field) => (
                <th key={field.code} scope="col" className={cn("px-4 py-3 font-semibold", field.fieldType === "number" && "text-right")}>
                  {field.name}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 font-semibold">状態</th>
              <th scope="col" className="px-4 py-3 font-semibold">更新</th>
            </tr>
          </thead>
          <tbody>
            {page.records.map((record, index) => {
              const isSelected = index === selectedIndex;
              const data = getRecordData(record);
              return (
                <tr
                  key={record.id}
                  data-testid={`record-row-${record.id}`}
                  data-guide={index === 0 ? "runtime-record-card" : undefined}
                  aria-current={isSelected ? "true" : undefined}
                  onClick={() => onSelect(record)}
                  className={cn(
                    "cursor-pointer border-t border-outline-variant",
                    isSelected
                      ? "bg-primary-container shadow-[inset_3px_0_0_var(--brand-strong)]"
                      : "hover:bg-surface-container-low"
                  )}
                >
                  <th scope="row" className="px-4 py-2">
                    <button
                      type="button"
                      data-record-row-trigger={record.id}
                      tabIndex={index === Math.max(0, selectedIndex) ? 0 : -1}
                      className="inline-flex min-h-10 max-w-64 items-center rounded py-1 text-left font-semibold text-on-surface focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className="line-clamp-2 wrap-anywhere">{getRecordTitle(record)}</span>
                    </button>
                    <span className="block max-w-64 truncate font-mono text-xs font-normal text-on-surface-variant">
                      {getRecordDisplayNumber(record) || record.id}
                    </span>
                  </th>
                  {columns.map((field) => (
                    <td key={field.code} className={cn("px-4 py-2", field.fieldType === "number" && "text-right tabular-nums")}>
                      <span className="line-clamp-2 max-w-64 wrap-anywhere">{getRuntimeFieldText(data[field.code], field.fieldType) || "—"}</span>
                    </td>
                  ))}
                  <td className="px-4 py-2"><StatusBadge status={record.status} /></td>
                  <td className="whitespace-nowrap px-4 py-2 text-on-surface-variant">{formatRelativeTime(record.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <nav aria-label="レコード一覧のページ切替" className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant px-4 py-2">
        <span className="text-sm tabular-nums text-on-surface-variant" aria-live="polite">
          {page.total}件中 {page.first}–{page.last}件を表示
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="lg" className="w-11 px-0 focus-visible:ring-2 focus-visible:ring-primary" aria-label="レコード一覧の前のページ" disabled={page.pageIndex === 0} onClick={() => goToPage(page.pageIndex - 1)}>
            <Icon name="chevron_left" />
          </Button>
          <Button type="button" variant="secondary" size="lg" className="w-11 px-0 focus-visible:ring-2 focus-visible:ring-primary" aria-label="レコード一覧の次のページ" disabled={page.pageIndex + 1 >= page.pageCount} onClick={() => goToPage(page.pageIndex + 1)}>
            <Icon name="chevron_right" />
          </Button>
        </div>
      </nav>
    </div>
  );
}

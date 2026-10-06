"use client";

import { Fragment, useState, type ReactNode } from "react";
import { getRecordPage } from "@/lib/runtime-pagination";
import type { AppRecord } from "@/types/record";

interface PaginatedRecordsProps {
  records: AppRecord[];
  label: string;
  renderRecord: (record: AppRecord) => ReactNode;
}

export function PaginatedRecords({ records, label, renderRecord }: PaginatedRecordsProps) {
  const [requestedPage, setRequestedPage] = useState(0);
  const page = getRecordPage(records, requestedPage);

  return (
    <>
      {page.pageCount > 1 && (
        <nav
          aria-label={`${label}のページ切替`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-container-low p-2 text-[11px] text-on-surface-variant"
        >
          <span aria-live="polite">{page.first}〜{page.last} / {page.total}件</span>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label={`${label}の前のページ`}
              disabled={page.pageIndex === 0}
              onClick={() => setRequestedPage(page.pageIndex - 1)}
              className="rounded-md bg-surface px-2.5 py-1.5 font-semibold hover:bg-surface-container disabled:opacity-40"
            >
              前へ
            </button>
            <button
              type="button"
              aria-label={`${label}の次のページ`}
              disabled={page.pageIndex === page.pageCount - 1}
              onClick={() => setRequestedPage(page.pageIndex + 1)}
              className="rounded-md bg-surface px-2.5 py-1.5 font-semibold hover:bg-surface-container disabled:opacity-40"
            >
              次へ
            </button>
          </div>
        </nav>
      )}
      {page.records.map((record) => <Fragment key={record.id}>{renderRecord(record)}</Fragment>)}
    </>
  );
}

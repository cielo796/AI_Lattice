"use client";

import Link from "next/link";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { useShellChrome } from "@/components/shared/ShellChrome";
import type { AppView } from "@/types/app";

interface TableHeaderProps {
  appCode: string;
  appName: string;
  tableCode: string;
  tableName: string;
  views: AppView[];
  activeView?: AppView;
  recordCount: number;
  query: string;
  canWriteRecords: boolean;
  isLoadingMeta: boolean;
  onQueryChange: (query: string) => void;
  onViewChange: (viewId: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
}

export function TableHeader({
  appCode,
  appName,
  tableCode,
  tableName,
  views,
  activeView,
  recordCount,
  query,
  canWriteRecords,
  isLoadingMeta,
  onQueryChange,
  onViewChange,
  onRefresh,
  onCreate,
}: TableHeaderProps) {
  const { openMobileNav } = useShellChrome();

  return (
    <header className="space-y-3 border-b border-outline-variant bg-surface px-4 py-4">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="lg" className="w-11 shrink-0 px-0 focus-visible:ring-2 focus-visible:ring-primary md:hidden" aria-label="メニューを開く" onClick={openMobileNav}>
          <Icon name="menu" />
        </Button>
        <nav aria-label="パンくず" className="flex min-w-0 items-center gap-2 text-sm text-on-surface-variant">
          <Link href={`/run/${encodeURIComponent(appCode)}`} className="flex min-h-10 min-w-0 items-center rounded-md hover:text-primary focus-visible:ring-2 focus-visible:ring-primary">
            <span className="truncate">{appName}</span>
          </Link>
          <Icon name="chevron_right" size="sm" className="shrink-0" />
          <span aria-current="page" className="truncate">{activeView?.name ?? "一覧"}</span>
        </nav>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="min-w-0 wrap-anywhere text-[26px] font-bold text-on-surface">{tableName}</h1>
          <span className="wrap-anywhere font-mono text-xs text-on-surface-variant">{tableCode}</span>
          <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs font-semibold tabular-nums text-on-surface-variant">
            {recordCount}件
          </span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-40" data-guide="runtime-record-search">
            <Icon name="search" size="sm" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="search"
              aria-label="レコードを検索"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="レコードを検索..."
              className="h-11 w-full rounded-md border border-outline bg-surface pl-8 pr-3 text-sm text-on-surface placeholder:text-on-surface-muted focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <Button type="button" variant="ghost" size="lg" className="w-11 shrink-0 px-0 focus-visible:ring-2 focus-visible:ring-primary" aria-label="更新" onClick={onRefresh}>
            <Icon name="sync" />
          </Button>
          <Button
            type="button"
            size="lg"
            className="max-w-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            onClick={onCreate}
            disabled={isLoadingMeta || !canWriteRecords}
            title={!canWriteRecords && !isLoadingMeta ? "この操作を行う権限がありません。" : undefined}
            data-guide="runtime-record-create-button"
          >
            <Icon name="add" size="sm" />
            {isLoadingMeta ? "スキーマを読み込み中..." : "レコードを追加"}
          </Button>
        </div>
      </div>

      <select
        aria-label="ビュー"
        data-guide="runtime-view-tabs"
        value={activeView?.id ?? ""}
        onChange={(event) => onViewChange(event.target.value)}
        className="min-h-10 max-w-full rounded-md border border-outline bg-surface px-3 text-sm text-on-surface focus-visible:ring-2 focus-visible:ring-primary md:hidden"
      >
        {views.length === 0 && <option value="">一覧</option>}
        {views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
      </select>
    </header>
  );
}

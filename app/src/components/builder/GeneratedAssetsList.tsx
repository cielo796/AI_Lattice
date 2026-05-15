"use client";

import { Icon } from "@/components/shared/Icon";
import { cn } from "@/lib/cn";

interface GeneratedAssetsListProps {
  aiInsight: string;
  tables: Array<{
    id: string;
    name: string;
    fieldCount: number;
  }>;
  activeTableId?: string;
  onSelectTable?: (tableId: string) => void;
}

export function GeneratedAssetsList({
  aiInsight,
  tables,
  activeTableId,
  onSelectTable,
}: GeneratedAssetsListProps) {
  return (
    <div>
      <h3 className="mb-6 font-headline text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
        生成された構成案
      </h3>
      <div className="space-y-6">
        <div>
          <div className="mb-3 flex items-center gap-2 px-2">
            <Icon name="table_chart" size="sm" className="text-on-surface-muted" />
            <span className="text-sm font-semibold text-on-surface">テーブル</span>
          </div>
          <div className="space-y-1">
            {tables.map((table) => (
              <button
                key={table.id}
                onClick={() => onSelectTable?.(table.id)}
                data-draggable
                className={cn(
                  "group flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors",
                  activeTableId === table.id
                    ? "bg-primary-container font-semibold text-on-primary-container"
                    : "text-on-surface hover:bg-surface-container-high"
                )}
              >
                <span className="drag-handle material-symbols-outlined text-base text-on-surface-muted">
                  drag_indicator
                </span>
                <span className="inline-editable truncate text-left">{table.name}</span>
                <span className="ml-auto mr-2 rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold text-on-surface-muted">
                  {table.fieldCount} フィールド
                </span>
                {activeTableId === table.id && (
                  <Icon name="check_circle" size="sm" className="text-primary" filled />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-tertiary-container bg-tertiary-container/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Icon name="auto_awesome" size="sm" filled className="text-primary" />
            AI インサイト
          </div>
          <p className="text-sm leading-relaxed text-on-surface">{aiInsight}</p>
        </div>
      </div>
    </div>
  );
}

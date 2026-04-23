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
      <h3 className="mb-6 font-headline text-sm font-bold uppercase tracking-widest text-on-surface-variant">
        生成された構成案
      </h3>
      <div className="space-y-6">
        <div>
          <div className="mb-3 flex items-center gap-2 px-2">
            <Icon name="table_chart" size="sm" className="text-on-surface-variant" />
            <span className="text-sm font-bold text-on-surface">テーブル</span>
          </div>
          <div className="space-y-1">
            {tables.map((table) => (
              <button
                key={table.id}
                onClick={() => onSelectTable?.(table.id)}
                className={cn(
                  "flex w-full items-center rounded-lg p-2 text-sm transition-colors",
                  activeTableId === table.id
                    ? "bg-surface-container-high font-semibold text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                <span>{table.name}</span>
                <span className="ml-auto mr-2 text-[10px] text-on-surface-variant">
                  {table.fieldCount} フィールド
                </span>
                {activeTableId === table.id && (
                  <Icon name="check_circle" size="sm" className="text-primary" filled />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-primary/15 bg-emerald-950/20 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
            <Icon name="auto_awesome" size="sm" filled className="text-primary" />
            AI インサイト
          </div>
          <p className="text-sm leading-relaxed text-on-surface">{aiInsight}</p>
        </div>
      </div>
    </div>
  );
}

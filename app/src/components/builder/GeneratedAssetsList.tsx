"use client";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/shared/Icon";
import type { AIGeneratedApp } from "@/types/ai";

interface GeneratedAssetsListProps {
  app: AIGeneratedApp;
  activeTableCode?: string;
  onSelectTable?: (code: string) => void;
}

export function GeneratedAssetsList({
  app,
  activeTableCode,
  onSelectTable,
}: GeneratedAssetsListProps) {
  return (
    <div>
      <h3 className="font-headline font-bold text-sm text-on-surface-variant uppercase tracking-widest mb-6">
        生成されたアセット
      </h3>
      <div className="space-y-6">
        {/* Tables */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-2">
            <Icon name="table_chart" size="sm" className="text-on-surface-variant" />
            <span className="text-sm font-bold text-on-surface">テーブル</span>
          </div>
          <div className="space-y-1">
            {app.tables.map((t) => (
              <button
                key={t.code}
                onClick={() => onSelectTable?.(t.code)}
                className={cn(
                  "w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors",
                  activeTableCode === t.code
                    ? "bg-surface-container-high text-primary font-semibold"
                    : "hover:bg-surface-container-high text-on-surface-variant"
                )}
              >
                <span>{t.name}</span>
                {activeTableCode === t.code && (
                  <Icon name="check_circle" size="sm" className="text-primary" filled />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Views */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-2">
            <Icon name="grid_view" size="sm" className="text-on-surface-variant" />
            <span className="text-sm font-bold text-on-surface">ビュー</span>
          </div>
          <div className="space-y-1">
            {app.views.map((v) => (
              <div
                key={v.name}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant text-sm transition-colors"
              >
                <span>{v.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Workflows */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-2">
            <Icon name="account_tree" size="sm" className="text-on-surface-variant" />
            <span className="text-sm font-bold text-on-surface">ワークフロー</span>
          </div>
          <div className="space-y-1">
            {app.workflows.map((w) => (
              <div
                key={w.name}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant text-sm transition-colors"
              >
                <span>{w.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

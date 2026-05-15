"use client";

import { Icon } from "@/components/shared/Icon";
import { Button } from "@/components/shared/Button";

interface FormPreviewProps {
  title: string;
  subtitle: string;
  aiInsight?: string;
}

export function FormPreview({ title, subtitle, aiInsight }: FormPreviewProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="font-headline text-2xl font-bold tracking-tight text-on-surface">{title}</h3>
          <p className="text-sm text-on-surface-muted">{subtitle}</p>
        </div>
        <div className="px-4 py-1.5 bg-primary-container text-on-primary-container rounded-full text-xs font-semibold flex items-center gap-2">
          <Icon name="auto_awesome" size="sm" filled />
          AI提案フィールド
        </div>
      </div>

      {/* Mock ticket detail form */}
      <div className="rounded-xl border border-outline-variant bg-surface p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-on-surface-muted mb-2 uppercase tracking-wider">
              件名
            </label>
            <div className="inline-editable w-full p-3 bg-surface-container-high rounded-lg text-on-surface font-medium">
              エンタープライズダッシュボードにアクセスできない
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-muted mb-2 uppercase tracking-wider">
              優先度
            </label>
            <div className="w-full p-3 bg-error-container/40 border border-error-container rounded-lg text-on-error-container font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-error" />
              クリティカル
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-muted mb-2 uppercase tracking-wider">
              顧客
            </label>
            <div className="inline-editable w-full p-3 bg-surface-container-high rounded-lg text-on-surface font-medium">
              Acme 株式会社
            </div>
          </div>
          {aiInsight && (
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-on-surface-muted mb-2 uppercase tracking-wider">
                AIインサイト：推奨アクション
              </label>
              <div className="w-full p-4 bg-tertiary-container/40 rounded-lg border border-tertiary-container">
                <p className="text-on-surface text-sm">{aiInsight}</p>
              </div>
            </div>
          )}
          <div className="col-span-2 pt-4">
            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="md">
                破棄
              </Button>
              <Button variant="primary" size="md">
                チケットを更新
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

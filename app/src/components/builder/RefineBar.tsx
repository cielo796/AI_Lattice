"use client";

import { type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { cn } from "@/lib/cn";
import type { AppRefinementChange } from "@/types/app-refinement";

interface RefineBarProps {
  value: string;
  isSubmitting?: boolean;
  disabled?: boolean;
  notice?: string | null;
  changes?: AppRefinementChange[];
  error?: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function RefineBar({
  value,
  isSubmitting = false,
  disabled = false,
  notice,
  changes = [],
  error,
  onChange,
  onSubmit,
}: RefineBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-outline-variant bg-surface px-4 py-3 shadow-[0_-1px_2px_rgba(15,23,42,0.04),0_-8px_24px_rgba(15,23,42,0.06)] md:left-64 md:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-2">
        {(notice || error) && (
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-medium",
              error
                ? "border-error-container bg-error-container/40 text-on-error-container"
                : "border-success-container bg-success-container/40 text-on-success-container"
            )}
          >
            <div>
              {error ?? notice}
              {changes.length > 0 && (
                <span className="ml-2 text-on-surface-variant">
                  {changes.length} 件の変更
                </span>
              )}
            </div>
            {changes.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-normal text-on-surface-variant">
                {changes.slice(0, 3).map((change) => (
                  <span key={`${change.type}-${change.tableCode}-${change.resourceName}`}>
                    {change.description}
                  </span>
                ))}
                {changes.length > 3 && <span>ほか {changes.length - 3} 件</span>}
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 md:flex-row md:items-center"
        >
          <div className="relative flex-1">
            <Icon
              name="edit_note"
              size="sm"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              disabled={disabled || isSubmitting}
              className="w-full rounded-full border border-outline-variant bg-surface-container-high py-3 pl-11 pr-4 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="AIで調整（例：SLAステータスを追加）"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={disabled || isSubmitting || !value.trim()}
            className="shrink-0"
          >
            <Icon name="auto_awesome" size="sm" filled />
            {isSubmitting ? "調整中..." : "AIで適用"}
          </Button>
        </form>
      </div>
    </footer>
  );
}

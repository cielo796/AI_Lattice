"use client";

import { Icon } from "@/components/shared/Icon";

export function AICommandBar() {
  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 md:bottom-6 md:left-1/2 md:right-auto md:w-full md:max-w-2xl md:-translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-outline-variant bg-surface px-4 py-2.5 shadow-card">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-tertiary">
          <Icon name="auto_awesome" filled size="sm" />
        </span>
        <input
          disabled
          aria-label="AIワークフロー編集（準備中）"
          placeholder="AIワークフロー編集は準備中です"
          className="flex-1 border-none bg-transparent text-[13.5px] text-on-surface placeholder:text-on-surface-muted focus:outline-none"
        />
        <button
          disabled
          aria-label="AIワークフロー編集はまだ利用できません"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm transition-colors hover:bg-primary-hover active:scale-95"
        >
          <Icon name="arrow_upward" size="sm" className="text-on-primary" />
        </button>
      </div>
    </div>
  );
}

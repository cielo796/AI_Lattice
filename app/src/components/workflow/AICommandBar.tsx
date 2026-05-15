"use client";

import { useState } from "react";
import { Icon } from "@/components/shared/Icon";

export function AICommandBar() {
  const [value, setValue] = useState("優先度がクリティカルの場合、マネージャー承認ステップを追加");

  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 md:bottom-6 md:left-1/2 md:right-auto md:w-full md:max-w-2xl md:-translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-outline-variant bg-surface px-4 py-2.5 shadow-[0_4px_8px_rgba(15,23,42,0.06),0_16px_40px_rgba(15,23,42,0.12)]">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-tertiary">
          <Icon name="auto_awesome" filled size="sm" />
        </span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="AI でワークフローを編集..."
          className="flex-1 border-none bg-transparent text-[13.5px] text-on-surface placeholder:text-on-surface-muted focus:outline-none"
        />
        <button
          aria-label="送信"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-sm transition-colors hover:bg-primary-hover active:scale-95"
        >
          <Icon name="arrow_upward" size="sm" className="text-white" />
        </button>
      </div>
    </div>
  );
}

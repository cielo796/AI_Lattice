"use client";

import { useState } from "react";
import { Icon } from "@/components/shared/Icon";

export function AICommandBar() {
  const [value, setValue] = useState("優先度がクリティカルの場合、マネージャー承認ステップを追加");

  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 md:bottom-6 md:left-1/2 md:right-auto md:w-full md:max-w-2xl md:-translate-x-1/2">
      <div className="glass-effect flex items-center gap-3 rounded-full px-5 py-3 shadow-2xl">
        <Icon name="auto_awesome" className="text-primary" filled size="sm" />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="flex-1 border-none bg-transparent text-sm text-white placeholder:text-on-surface-variant/50 focus:outline-none"
        />
        <button className="flex h-8 w-8 items-center justify-center rounded-full bg-primary transition-colors hover:bg-emerald-600">
          <Icon name="arrow_upward" size="sm" className="text-white" />
        </button>
      </div>
    </div>
  );
}

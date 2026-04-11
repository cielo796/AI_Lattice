"use client";

import { useState } from "react";
import { Icon } from "@/components/shared/Icon";

export function AICommandBar() {
  const [value, setValue] = useState("優先度がクリティカルの場合、マネージャー承認ステップを追加");
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl z-20">
      <div className="glass-effect rounded-full flex items-center gap-3 px-5 py-3 shadow-2xl">
        <Icon name="auto_awesome" className="text-primary" filled size="sm" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 bg-transparent border-none focus:outline-none text-sm text-white placeholder:text-on-surface-variant/50"
        />
        <button className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-emerald-600 transition-colors">
          <Icon name="arrow_upward" size="sm" className="text-white" />
        </button>
      </div>
    </div>
  );
}

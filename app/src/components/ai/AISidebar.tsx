"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/shared/Icon";

interface AISidebarProps {
  children?: React.ReactNode;
  title?: string;
  className?: string;
}

const tabs = [
  { id: "summary", label: "サマリー", icon: "auto_awesome" },
  { id: "actions", label: "アクション", icon: "bolt" },
  { id: "context", label: "コンテキスト", icon: "view_in_ar" },
];

export function AISidebar({
  children,
  title = "AIアシスタント",
  className,
}: AISidebarProps) {
  const [activeTab, setActiveTab] = useState("summary");

  return (
    <aside
      className={cn(
        "w-full shrink-0 border-l border-outline-variant bg-surface",
        className
      )}
    >
      <div className="border-b border-outline-variant px-5 pb-4 pt-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-tertiary text-white shadow-sm">
            <Icon name="auto_awesome" size="sm" filled />
          </span>
          <span className="text-[13px] font-semibold text-on-surface">
            {title}
          </span>
          <span className="ml-auto rounded-full bg-tertiary-container px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-on-tertiary-container">
            コンテキスト分析
          </span>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">{children}</div>

      <div className="flex border-t border-outline-variant">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 py-3 text-[10.5px] font-semibold tracking-wider transition-colors",
              activeTab === tab.id
                ? "text-primary"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            <Icon name={tab.icon} size="sm" />
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute inset-x-3 top-0 h-[2.5px] rounded-b-full bg-primary" />
            )}
          </button>
        ))}
      </div>
    </aside>
  );
}

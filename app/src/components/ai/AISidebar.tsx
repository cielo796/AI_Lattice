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
      className={cn("w-full shrink-0 bg-surface-container-low", className)}
    >
      <div className="px-6 pb-4 pt-6">
        <div className="mb-4 flex items-center gap-2">
          <Icon name="auto_awesome" size="sm" className="text-primary" filled />
          <span className="text-xs font-bold tracking-widest text-primary">
            {title}
          </span>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-on-surface-variant">
            コンテキスト分析
          </span>
        </div>
      </div>

      <div className="space-y-4 px-6 pb-6">
        {children}
      </div>

      <div className="flex border-t border-outline-variant/20">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-bold tracking-wider transition-colors",
              activeTab === tab.id
                ? "bg-primary/5 text-primary"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            <Icon name={tab.icon} size="sm" />
            {tab.label}
          </button>
        ))}
      </div>
    </aside>
  );
}

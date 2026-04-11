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
  { id: "summary", label: "SUMMARY", icon: "auto_awesome" },
  { id: "actions", label: "ACTIONS", icon: "bolt" },
  { id: "context", label: "CONTEXT", icon: "view_in_ar" },
];

export function AISidebar({ children, title = "AI ASSISTANT", className }: AISidebarProps) {
  const [activeTab, setActiveTab] = useState("summary");

  return (
    <aside
      className={cn(
        "w-80 shrink-0 h-full flex flex-col bg-surface-container-low",
        className
      )}
    >
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="auto_awesome" size="sm" className="text-primary" filled />
          <span className="text-xs font-bold text-primary tracking-widest">
            {title}
          </span>
          <span className="ml-auto text-[10px] text-on-surface-variant uppercase tracking-wider">
            Contextual Intelligence
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
        {children}
      </div>

      {/* Bottom tabs */}
      <div className="flex border-t border-outline-variant/20">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold tracking-wider transition-colors",
              activeTab === tab.id
                ? "text-primary bg-primary/5"
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

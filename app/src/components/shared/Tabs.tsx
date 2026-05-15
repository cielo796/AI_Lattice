"use client";

import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

interface Tab {
  id: string;
  label: string;
  icon?: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex items-end gap-0 border-b border-outline-variant",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative -mb-px flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold tracking-tight transition-colors",
              isActive
                ? "text-on-surface"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {tab.icon && <Icon name={tab.icon} size="sm" />}
            {tab.label}
            <span
              className={cn(
                "absolute inset-x-2 bottom-0 h-[2.5px] rounded-full transition-colors",
                isActive ? "bg-primary" : "bg-transparent"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

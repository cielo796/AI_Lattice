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
    <div className={cn("flex gap-1 bg-surface-container rounded-lg p-1", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors",
            activeTab === tab.id
              ? "bg-primary/10 text-primary"
              : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          {tab.icon && <Icon name={tab.icon} size="sm" />}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

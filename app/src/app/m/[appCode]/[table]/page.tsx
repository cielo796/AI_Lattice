"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/shared/Icon";
import { Badge } from "@/components/shared/Badge";
import { mockRecords } from "@/data/mock-records";

const tabs = [
  { id: "all", label: "対応中" },
  { id: "high", label: "優先度：高" },
  { id: "ai", label: "AI提案" },
];

const priorityVariant: { [k: string]: "error" | "warning" | "info" | "default" } = {
  クリティカル: "error",
  高: "warning",
  中: "info",
  低: "default",
};

export default function MobileRuntimePage() {
  const [activeTab, setActiveTab] = useState("all");

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="glass-effect sticky top-0 z-20 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-headline font-extrabold text-white text-base tracking-tight">
            AI Lattice
          </h1>
          <button className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
            <Icon name="notifications" size="md" />
          </button>
        </div>
        <div className="relative">
          <Icon
            name="search"
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            placeholder="チケットやインサイトを検索..."
            className="w-full pl-9 pr-4 py-2.5 bg-surface-container rounded-full text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </header>

      {/* Tabs */}
      <div className="overflow-x-auto px-4 py-3 border-b border-outline-variant/20">
        <div className="flex gap-2 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider whitespace-nowrap transition-colors",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "bg-surface-container text-on-surface-variant"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
        {mockRecords.slice(0, 5).map((rec) => {
          const data = rec.data as { [key: string]: string };
          const isAI = data.priority === "クリティカル";
          return (
            <div
              key={rec.id}
              className={cn(
                "bg-surface-container rounded-xl p-4",
                isAI && "border border-primary/30"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-on-surface-variant">
                  {data.ticket_id}
                </span>
                <div className="flex items-center gap-2">
                  {isAI && <Badge variant="ai">AI提案</Badge>}
                  <Badge variant={priorityVariant[data.priority] ?? "default"}>
                    {data.priority}
                  </Badge>
                </div>
              </div>
              <h3 className="font-bold text-on-surface text-sm mb-1.5 leading-snug">
                {data.subject}
              </h3>
              <p className="text-xs text-on-surface-variant line-clamp-2 mb-3">
                {data.description}
              </p>
              {isAI && (
                <button className="text-[10px] font-bold text-primary flex items-center gap-1">
                  <Icon name="auto_awesome" size="sm" filled />
                  AI解決パスを表示
                </button>
              )}
            </div>
          );
        })}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 glass-effect flex items-center justify-around py-3 z-20">
        {[
          { icon: "home", label: "ホーム" },
          { icon: "apps", label: "アプリ" },
          { icon: "task", label: "タスク", active: true },
          { icon: "search", label: "検索" },
        ].map((item) => (
          <button
            key={item.label}
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-1",
              item.active ? "text-primary" : "text-on-surface-variant"
            )}
          >
            <Icon name={item.icon} size="md" />
            <span className="text-[9px] font-bold tracking-wider">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* FAB */}
      <button className="fixed bottom-24 right-4 w-14 h-14 bg-primary rounded-full shadow-2xl flex items-center justify-center z-30">
        <Icon name="add" size="lg" className="text-white" />
      </button>
    </div>
  );
}

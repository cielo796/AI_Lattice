"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/shared/Badge";
import { Icon } from "@/components/shared/Icon";
import { cn } from "@/lib/cn";
import { listRecords } from "@/lib/api/records";
import {
  getPriorityVariant,
  getRecordDescription,
  getRecordIdentifier,
  getRecordPriority,
  getRecordSentiment,
  getRecordTitle,
} from "@/lib/runtime-records";
import type { AppRecord } from "@/types/record";

const tabs = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "priority", label: "Priority" },
];

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function MobileRuntimePage() {
  const params = useParams<{ appCode: string; table: string }>();
  const appCode = getParam(params.appCode);
  const tableCode = getParam(params.table);

  const [activeTab, setActiveTab] = useState("all");
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<AppRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appCode || !tableCode) {
      setError("Missing runtime route parameters.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRuntimeRecords() {
      try {
        setIsLoading(true);
        const nextRecords = await listRecords(appCode, tableCode);

        if (cancelled) {
          return;
        }

        setRecords(nextRecords);
        setError(null);
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setRecords([]);
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to load runtime records."
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadRuntimeRecords();

    return () => {
      cancelled = true;
    };
  }, [appCode, tableCode]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRecords = records.filter((record) => {
    if (activeTab === "open" && !record.status.toLowerCase().includes("open")) {
      return false;
    }

    if (activeTab === "priority") {
      const priority = getRecordPriority(record);
      const variant = priority ? getPriorityVariant(priority) : "default";
      if (variant !== "error" && variant !== "warning") {
        return false;
      }
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      getRecordIdentifier(record),
      getRecordTitle(record),
      getRecordDescription(record),
      getRecordPriority(record),
      record.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="glass-effect sticky top-0 z-20 px-4 pb-4 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-headline text-base font-extrabold tracking-tight text-white">
            Runtime
          </h1>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search records..."
            className="w-full rounded-full bg-surface-container py-2.5 pl-9 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </header>

      <div className="overflow-x-auto border-b border-outline-variant/20 px-4 py-3">
        <div className="flex min-w-max gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-1.5 text-[10px] font-bold tracking-wider transition-colors",
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

      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {error && (
          <div className="mb-3 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">
            Loading records...
          </div>
        )}

        {!isLoading && filteredRecords.length === 0 && (
          <div className="rounded-xl border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
            No records found.
          </div>
        )}

        <div className="space-y-3">
          {filteredRecords.map((record) => {
            const priority = getRecordPriority(record);
            const sentiment = getRecordSentiment(record);

            return (
              <div
                key={record.id}
                className="rounded-xl bg-surface-container p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    {getRecordIdentifier(record)}
                  </span>
                  <div className="flex items-center gap-2">
                    {typeof sentiment === "number" && sentiment < -0.5 && (
                      <Badge variant="ai">Needs attention</Badge>
                    )}
                    {priority && (
                      <Badge variant={getPriorityVariant(priority)}>
                        {priority}
                      </Badge>
                    )}
                  </div>
                </div>

                <h3 className="mb-1.5 text-sm font-bold leading-snug text-on-surface">
                  {getRecordTitle(record)}
                </h3>

                <p className="mb-3 line-clamp-2 text-xs text-on-surface-variant">
                  {getRecordDescription(record) || "No description"}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-on-surface-variant">
                    {record.status}
                  </span>
                  <button className="flex items-center gap-1 text-[10px] font-bold text-primary">
                    <Icon name="visibility" size="sm" />
                    Open
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <nav className="glass-effect fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around py-3">
        {[
          { icon: "home", label: "Home" },
          { icon: "apps", label: "Apps" },
          { icon: "task", label: "Records", active: true },
          { icon: "search", label: "Search" },
        ].map((item) => (
          <button
            key={item.label}
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-1",
              item.active ? "text-primary" : "text-on-surface-variant"
            )}
          >
            <Icon name={item.icon} size="md" />
            <span className="text-[9px] font-bold tracking-wider">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <button className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-2xl">
        <Icon name="add" size="lg" className="text-white" />
      </button>
    </div>
  );
}

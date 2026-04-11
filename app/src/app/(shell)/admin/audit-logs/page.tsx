"use client";

import { useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { Badge } from "@/components/shared/Badge";
import { mockAuditLogs } from "@/data/mock-audit-logs";
import type { AuditLog } from "@/types/audit";
import { cn } from "@/lib/cn";

const actionTypeVariant: { [key: string]: "info" | "ai" | "warning" | "default" } = {
  SCHEMA_UPDATE: "info",
  NODE_SCALING: "ai",
  ACCESS_DENIED: "warning",
  AUTH_LOGIN: "default",
  API_KEY_ROT: "warning",
};

const aiInvolvementVariant: { [key: string]: "ai" | "info" | "warning" | "default" } = {
  autonomous: "ai",
  predictive: "info",
  assisted: "warning",
  none: "default",
};

export default function AuditLogsPage() {
  const [selected, setSelected] = useState<AuditLog>(mockAuditLogs[0]);

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: "Admin Panel" }, { label: "Audit Logs" }]}
        actions={
          <>
            <Button variant="ghost" size="md">
              <Icon name="monitoring" size="sm" />
              System Health
            </Button>
            <Button variant="primary" size="md">
              <Icon name="rocket_launch" size="sm" />
              Deploy
            </Button>
          </>
        }
      />

      <main className="pt-16 px-10 py-10 max-w-[1800px] mx-auto">
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Date Range", value: "Last 24 Hours", icon: "calendar_today" },
            { label: "User Account", value: "All Users", icon: "person" },
            { label: "Action Type", value: "Any Action", icon: "filter_alt" },
            {
              label: "Involvement",
              value: "AI Managed",
              icon: "auto_awesome",
              highlight: true,
            },
          ].map((filter) => (
            <div
              key={filter.label}
              className="bg-surface-container rounded-lg p-4"
            >
              <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                {filter.label}
              </div>
              <button className="flex items-center justify-between w-full text-sm font-bold text-white">
                <span
                  className={filter.highlight ? "text-primary" : "text-white"}
                >
                  {filter.value}
                </span>
                <Icon
                  name={filter.highlight ? "check_circle" : "expand_more"}
                  size="sm"
                  className={filter.highlight ? "text-primary" : "text-on-surface-variant"}
                  filled={filter.highlight}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Log table + detail panel */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Table */}
          <div className="bg-surface-container rounded-xl overflow-hidden">
            <div className="grid grid-cols-[140px_120px_140px_1fr] gap-4 px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              <div>Timestamp</div>
              <div>User</div>
              <div>Action</div>
              <div>Resource</div>
            </div>
            <div>
              {mockAuditLogs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => setSelected(log)}
                  className={cn(
                    "w-full grid grid-cols-[140px_120px_140px_1fr] gap-4 px-6 py-4 items-center text-left transition-colors",
                    selected.id === log.id
                      ? "bg-surface-container-high"
                      : "hover:bg-surface-container-high/50"
                  )}
                >
                  <div className="text-xs font-mono text-on-surface-variant">
                    {log.createdAt.slice(0, 19).replace("T", " ")}
                  </div>
                  <div className="text-xs font-bold text-on-surface">
                    {log.actorName}
                  </div>
                  <div>
                    <Badge
                      variant={actionTypeVariant[log.actionType] ?? "default"}
                      className="text-[9px]"
                    >
                      {log.actionType}
                    </Badge>
                  </div>
                  <div className="text-xs font-mono text-on-surface-variant truncate">
                    {log.resourceName}
                  </div>
                </button>
              ))}
            </div>
            <div className="px-6 py-4 flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">
                Showing 1 to 25 of 1,422 entries
              </span>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-xs bg-surface-container-high rounded text-on-surface-variant">
                  Previous
                </button>
                <button className="px-3 py-1 text-xs bg-surface-container-high rounded text-on-surface-variant">
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Detail panel */}
          <aside className="bg-surface-container rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-headline font-bold text-white">Event Detail</div>
              <span className="text-[10px] font-mono text-on-surface-variant">
                ID: {selected.id}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Icon name="edit_note" size="sm" className="text-blue-400" />
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                  Operation
                </span>
              </div>
              <div className="text-lg font-headline font-bold text-white">
                {selected.actionType}
              </div>
              <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                {String(selected.detailJson?.changes ?? selected.detailJson?.reason ?? "A major update was performed on the system.")}
              </p>
            </div>

            {selected.aiInvolvement && selected.aiInvolvement !== "none" && (
              <div className="bg-emerald-950/30 border border-primary/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="auto_awesome" size="sm" className="text-primary" filled />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                    AI Insights
                  </span>
                </div>
                <p className="text-xs text-on-surface">
                  <span className="text-primary font-bold">AUTOMATED ACTION</span> \u00b7
                  This action was pre-validated by the Core Auditor AI. Risk score:{" "}
                  <span className="text-primary font-bold">0.02 (Low)</span>.
                </p>
                <button className="text-[11px] text-primary font-bold mt-2 flex items-center gap-1">
                  View Validation Log <Icon name="arrow_forward" size="sm" />
                </button>
              </div>
            )}

            <div>
              <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                Raw Payload
              </div>
              <pre className="bg-surface-container-low rounded-lg p-3 text-[10px] font-mono text-on-surface-variant overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(
  {
    event: selected.actionType,
    actor: {
      uid: selected.actorId,
      role: "admin",
      ip: selected.ipAddress ?? "10.0.1.56",
    },
    resource: selected.resourceName,
    changes: selected.detailJson,
    ai_check: {
      validated: true,
      validation_score: "very_high",
    },
  },
  null,
  2
)}
              </pre>
            </div>

            <Button variant="primary" size="md" className="w-full justify-center">
              <Icon name="download" size="sm" />
              Export Event as JSON
            </Button>
          </aside>
        </div>
      </main>
    </>
  );
}

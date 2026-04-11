"use client";

import { TopBar } from "@/components/shared/TopBar";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { Badge } from "@/components/shared/Badge";
import { mockAIFlowHistory } from "@/data/mock-ai-responses";
import { cn } from "@/lib/cn";

export default function ApprovalsPage() {
  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Dashboard" },
          { label: "Admin" },
          { label: "Approvals" },
        ]}
        actions={
          <Button variant="primary" size="md">
            <Icon name="share" size="sm" />
            Share
          </Button>
        }
      />

      <main className="pt-16 px-10 py-10 max-w-7xl mx-auto">
        {/* Title */}
        <div className="mb-6">
          <div className="text-xs text-on-surface-variant mb-2">Tickets / OPS-4291</div>
          <h1 className="font-headline text-4xl font-extrabold text-white">
            Database latency spikes in US-EAST-1
          </h1>
        </div>

        {/* Proposed Change banner */}
        <div className="bg-emerald-950/40 border border-primary/30 rounded-xl p-5 mb-8 flex items-center gap-4">
          <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center shrink-0">
            <Icon name="auto_awesome" className="text-primary" size="md" filled />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-white">
                Proposed Change: Escalation to Critical
              </span>
              <Badge variant="ai">AI SUGGESTION</Badge>
            </div>
            <p className="text-xs text-on-surface-variant">
              AI Insight: User sentiment analysis indicates high frustration and database
              timeout issues. Automated pattern matching suggests a cascading failure risk.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="primary" size="md">
              Accept Update
            </Button>
            <Button variant="ghost" size="md">
              Reject
            </Button>
          </div>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface-container rounded-xl p-6">
              <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                Description
              </div>
              <p className="text-sm text-on-surface leading-relaxed">
                Multiple reports from core enterprise customers regarding timeout errors
                on the primary reporting dashboard. Initial logs show a steady increase in
                query execution time starting at 08:42 UTC.
              </p>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <div>
                  <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                    Priority
                  </div>
                  <Badge variant="warning">High</Badge>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                    Status
                  </div>
                  <Badge variant="info">Investigating</Badge>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                    Category
                  </div>
                  <Badge variant="default">Database</Badge>
                </div>
              </div>
            </div>

            {/* Mock chart */}
            <div className="bg-surface-container rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Sentiment & Latency Correlation
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className="flex items-center gap-1 text-blue-400">
                    <span className="w-2 h-2 bg-blue-400 rounded-full" /> Latency
                  </span>
                  <span className="flex items-center gap-1 text-primary">
                    <span className="w-2 h-2 bg-primary rounded-full" /> Sentiment
                  </span>
                </div>
              </div>
              <div className="relative h-40 flex items-end justify-between gap-2">
                {[40, 55, 35, 65, 50, 75, 90, 85, 95, 70, 80, 100].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-blue-500/50 to-blue-400 rounded-t"
                    style={{ height: `${h}%` }}
                  />
                ))}
                <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline
                    points="0,60 8,55 16,65 24,50 32,55 40,45 48,35 56,30 64,25 72,35 80,30 92,20"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-surface-container rounded-xl p-6">
              <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">
                Metadata
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-xs text-on-surface-variant">Created</span>
                  <span className="text-xs text-on-surface font-bold">2 hours ago</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-on-surface-variant">Reporter</span>
                  <span className="text-xs text-on-surface font-bold">Sarah Jenkins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-on-surface-variant">Node ID</span>
                  <span className="text-xs text-on-surface font-mono">NODE_XENL_A</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-container rounded-xl p-6">
              <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">
                AI Flow History
              </div>
              <div className="space-y-4 relative">
                {mockAIFlowHistory.map((item, i) => (
                  <div key={item.id} className="flex gap-3 relative">
                    {i < mockAIFlowHistory.length - 1 && (
                      <div className="absolute left-[5px] top-4 bottom-[-16px] w-px bg-outline-variant/40" />
                    )}
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full mt-1 shrink-0 relative z-10",
                        item.status === "completed" && "bg-primary",
                        item.status === "proposed" && "bg-amber-400",
                        item.status === "pending" && "bg-outline-variant"
                      )}
                    />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-on-surface">
                        {item.action}
                      </div>
                      <div className="text-[10px] text-on-surface-variant">
                        {item.detail} {item.timestamp && `\u00b7 ${item.timestamp}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-container rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Icon name="monitoring" className="text-primary" />
                <span className="text-sm font-bold text-white">System Health</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-on-surface-variant uppercase">
                    CPU Load
                  </div>
                  <div className="text-2xl font-headline font-bold text-blue-400">
                    82%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-on-surface-variant uppercase">
                    Error Rate
                  </div>
                  <div className="text-2xl font-headline font-bold text-error">1.4%</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Human-in-the-Loop flow */}
        <div className="mt-10">
          <h2 className="font-headline text-xl font-bold text-white mb-4">
            Human-in-the-Loop Workflow
          </h2>
          <div className="bg-surface-container rounded-xl p-6 flex items-center justify-between gap-4">
            {["Proposal", "Review", "Approval", "Execution"].map((step, i) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={cn(
                    "flex flex-col items-center gap-2 flex-1",
                    i < 2 ? "text-primary" : i === 2 ? "text-amber-400" : "text-on-surface-variant"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                      i < 2
                        ? "bg-primary/20"
                        : i === 2
                        ? "bg-amber-500/20 ring-2 ring-amber-400"
                        : "bg-surface-container-high"
                    )}
                  >
                    {i < 2 ? <Icon name="check" size="sm" /> : i + 1}
                  </div>
                  <span className="text-xs font-bold">{step}</span>
                  {i === 2 && (
                    <span className="text-[9px] text-amber-400 uppercase tracking-wider">
                      Awaiting
                    </span>
                  )}
                </div>
                {i < 3 && <div className="flex-1 h-px bg-outline-variant/40 mx-2" />}
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

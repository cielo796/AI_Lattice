"use client";

import { useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { RecordList } from "@/components/runtime/RecordList";
import { RecordDetail } from "@/components/runtime/RecordDetail";
import { AISidebar } from "@/components/ai/AISidebar";
import { mockRecords } from "@/data/mock-records";
import { mockRecordSummary } from "@/data/mock-ai-responses";
import type { AppRecord } from "@/types/record";

export default function RuntimeViewPage() {
  const [selected, setSelected] = useState<AppRecord>(mockRecords[0]);

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: "Dashboard" }, { label: "Tickets" }]}
        actions={
          <>
            <Button variant="ghost" size="md">
              <Icon name="visibility" size="sm" />
              Preview
            </Button>
            <Button variant="primary" size="md">
              <Icon name="rocket_launch" size="sm" />
              Deploy
            </Button>
          </>
        }
      />

      <main className="pt-16 h-screen flex">
        <RecordList
          records={mockRecords}
          selectedId={selected.id}
          onSelect={setSelected}
        />
        <RecordDetail record={selected} />

        {/* AI Sidebar */}
        <AISidebar>
          <div>
            <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
              Issue Summary
            </div>
            <p className="text-xs text-on-surface leading-relaxed">
              {mockRecordSummary.summary}
            </p>
          </div>

          <div>
            <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">
              Recommended Actions
            </div>
            <div className="space-y-2">
              {mockRecordSummary.recommendedActions.map((action) => (
                <button
                  key={action.label}
                  className="w-full flex items-center gap-3 p-3 bg-surface-container rounded-lg hover:bg-surface-container-high transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                    <Icon name={action.icon} size="sm" className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-on-surface">
                      {action.label}
                    </div>
                    <div className="text-[10px] text-on-surface-variant truncate">
                      {action.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">
              Similar Incidents
            </div>
            <div className="space-y-2">
              {mockRecordSummary.similarIncidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-3 bg-surface-container rounded-lg"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold text-primary uppercase">
                      {inc.matchPercentage}% MATCH
                    </span>
                    <span className="text-[9px] text-on-surface-variant">
                      {inc.date}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-on-surface mb-1 line-clamp-2">
                    {inc.title}
                  </div>
                  <p className="text-[10px] text-on-surface-variant line-clamp-2">
                    {inc.resolution}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </AISidebar>
      </main>
    </>
  );
}

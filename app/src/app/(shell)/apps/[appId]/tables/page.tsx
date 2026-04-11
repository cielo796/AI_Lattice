"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/shared/TopBar";
import { Icon } from "@/components/shared/Icon";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { AISidebar } from "@/components/ai/AISidebar";
import { mockTables, mockFields } from "@/data/mock-tables";
import { cn } from "@/lib/cn";

const fieldTypeIcons: Record<string, { icon: string; label: string; variant: string }> = {
  text: { icon: "text_fields", label: "Text", variant: "default" },
  textarea: { icon: "notes", label: "Textarea", variant: "default" },
  number: { icon: "numbers", label: "Number", variant: "info" },
  date: { icon: "calendar_today", label: "Date", variant: "info" },
  datetime: { icon: "schedule", label: "Date", variant: "info" },
  boolean: { icon: "toggle_on", label: "Boolean", variant: "default" },
  select: { icon: "list", label: "Select", variant: "warning" },
  user_ref: { icon: "person", label: "User Ref", variant: "info" },
  master_ref: { icon: "link", label: "Master Ref", variant: "info" },
  file: { icon: "attach_file", label: "File", variant: "default" },
  ai_generated: { icon: "auto_awesome", label: "AI", variant: "ai" },
  calculated: { icon: "functions", label: "Calc", variant: "warning" },
};

export default function TableDesignerPage() {
  const [activeTableId, setActiveTableId] = useState("tbl-001");
  const activeFields = mockFields.filter((f) => f.tableId === activeTableId);
  const activeTable = mockTables.find((t) => t.id === activeTableId);

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Dashboard" },
          { label: "Support Desk" },
          { label: "Tables" },
        ]}
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
        {/* Left: Tables List */}
        <aside className="w-64 bg-surface-container p-6 overflow-y-auto">
          <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">
            Your Tables
          </div>
          <div className="space-y-2">
            {mockTables.map((table) => (
              <button
                key={table.id}
                onClick={() => setActiveTableId(table.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors",
                  activeTableId === table.id
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon name="table_chart" size="sm" />
                  <span className="text-sm">{table.name}</span>
                </div>
                {activeTableId === table.id && (
                  <Badge variant="success" className="text-[9px]">
                    ACTIVE
                  </Badge>
                )}
              </button>
            ))}
          </div>

          <button className="mt-4 w-full p-3 border-2 border-dashed border-outline-variant/40 rounded-lg text-on-surface-variant hover:text-primary hover:border-primary/40 text-sm transition-colors">
            <Icon name="add" size="sm" /> New Table
          </button>

          {/* AI Insights */}
          <div className="mt-8 bg-emerald-950/30 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="auto_awesome" size="sm" className="text-primary" filled />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                AI Insights
              </span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Analyzing ticket volume... High density detected in &quot;Bug Reports&quot;.
              Consider adding a Severity index.
            </p>
          </div>
        </aside>

        {/* Center: Field Editor */}
        <section className="flex-1 overflow-y-auto p-10 bg-surface">
          <div className="max-w-3xl">
            <h2 className="font-headline text-3xl font-bold text-white mb-2">
              Table: {activeTable?.name}
            </h2>
            <p className="text-sm text-on-surface-variant mb-8">
              Define the attributes and logic for your support ticket data structure.
            </p>

            {/* Smart suggestion */}
            <div className="bg-emerald-950/30 border border-primary/20 rounded-xl p-4 mb-8">
              <div className="flex items-start gap-3">
                <Icon
                  name="auto_awesome"
                  className="text-primary mt-0.5"
                  size="md"
                  filled
                />
                <div className="flex-1">
                  <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                    Smart Suggestion
                  </div>
                  <p className="text-sm text-on-surface">
                    AI suggests adding an <span className="text-primary font-bold">
                      [Incident Priority]
                    </span>{" "}
                    field based on your app description.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="secondary">
                      Apply
                    </Button>
                    <Button size="sm" variant="ghost">
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Field Header */}
            <div className="grid grid-cols-[2fr_1fr_80px] gap-4 px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              <div>Field Name</div>
              <div>Type</div>
              <div></div>
            </div>

            {/* Field List */}
            <div className="space-y-2">
              {activeFields.map((field) => {
                const typeMeta = fieldTypeIcons[field.fieldType] ?? {
                  icon: "help",
                  label: field.fieldType,
                  variant: "default",
                };
                return (
                  <div
                    key={field.id}
                    className="grid grid-cols-[2fr_1fr_80px] gap-4 items-center p-4 bg-surface-container rounded-lg hover:bg-surface-container-high transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-mono text-sm",
                          field.fieldType === "ai_generated"
                            ? "text-primary font-bold"
                            : "text-on-surface"
                        )}
                      >
                        {field.name}
                      </span>
                      {field.required && (
                        <span className="text-error text-xs">*</span>
                      )}
                    </div>
                    <div>
                      <Badge
                        variant={typeMeta.variant as "default" | "success" | "warning" | "error" | "info" | "ai"}
                      >
                        {field.fieldType === "ai_generated" && (
                          <Icon name="auto_awesome" size="sm" filled />
                        )}
                        {typeMeta.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="w-7 h-7 rounded hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant">
                        <Icon name="edit" size="sm" />
                      </button>
                      <button className="w-7 h-7 rounded hover:bg-error/10 hover:text-error flex items-center justify-center text-on-surface-variant">
                        <Icon name="delete" size="sm" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <button className="w-full p-4 border-2 border-dashed border-outline-variant/40 rounded-lg text-on-surface-variant hover:text-primary hover:border-primary/40 text-sm transition-colors flex items-center justify-center gap-2">
                <Icon name="add" size="sm" />
                Click to add a new field
              </button>
            </div>

            <div className="mt-10 flex justify-end gap-3">
              <Link href={`/apps/app-001/workflows`}>
                <Button variant="ghost" size="md">
                  Next: Workflows
                  <Icon name="arrow_forward" size="sm" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Right: AI Sidebar */}
        <AISidebar>
          <div>
            <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
              AI Summary
            </div>
            <p className="text-xs text-on-surface leading-relaxed mb-4">
              Currently editing the{" "}
              <span className="text-primary font-bold">Tickets</span> schema. 4 core
              fields + 1 AI-generated sentiment field.
            </p>
          </div>

          <div>
            <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
              Quick Actions
            </div>
            <div className="space-y-2">
              <button className="w-full text-left p-3 bg-surface-container-high rounded-lg text-xs text-on-surface hover:bg-surface-container-highest transition-colors">
                Generate sample data
              </button>
              <button className="w-full text-left p-3 bg-surface-container-high rounded-lg text-xs text-on-surface hover:bg-surface-container-highest transition-colors">
                Link external source
              </button>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
              Model Training Status
            </div>
            <div className="bg-surface-container-high rounded-lg p-3">
              <div className="flex justify-between text-xs text-on-surface-variant mb-2">
                <span>Sentiment model</span>
                <span className="text-primary font-bold">82%</span>
              </div>
              <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: "82%" }} />
              </div>
            </div>
          </div>
        </AISidebar>
      </main>
    </>
  );
}

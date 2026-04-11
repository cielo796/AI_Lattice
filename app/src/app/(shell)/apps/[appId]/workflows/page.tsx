"use client";

import { TopBar } from "@/components/shared/TopBar";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { AISidebar } from "@/components/ai/AISidebar";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { WorkflowToolbar } from "@/components/workflow/WorkflowToolbar";
import { AICommandBar } from "@/components/workflow/AICommandBar";

export default function WorkflowEditorPage() {
  return (
    <>
      <TopBar
        breadcrumbs={[{ label: "Dashboard" }, { label: "Workflow Automation Editor" }]}
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
        {/* Left: Canvas */}
        <section className="flex-1 relative">
          <WorkflowToolbar />
          <WorkflowCanvas />
          <AICommandBar />
        </section>

        {/* Right: AI Assistant */}
        <AISidebar>
          <div className="bg-emerald-950/30 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="auto_awesome" size="sm" className="text-primary" filled />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                Suggested Improvement
              </span>
            </div>
            <p className="text-xs text-on-surface leading-relaxed mb-3">
              I&apos;ve drafted a manager approval node connected to your primary
              trigger. This ensures high-value records are reviewed before Slack
              notifications.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary">
                APPLY CHANGES
              </Button>
              <button className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-white flex items-center justify-center">
                <Icon name="close" size="sm" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-surface-container-high rounded-xl p-3 text-xs text-on-surface ml-6">
              Add a manager approval step if priority is critical
            </div>
            <div className="bg-surface-container rounded-xl p-3 text-xs text-on-surface-variant">
              Analyzing workflow context... I have identified the optimal insertion
              point between &quot;Condition&quot; and &quot;Notification&quot;. Generating nodes now.
            </div>
          </div>
        </AISidebar>
      </main>
    </>
  );
}

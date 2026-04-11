"use client";

import Link from "next/link";
import { TopBar } from "@/components/shared/TopBar";
import { Icon } from "@/components/shared/Icon";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { mockApps } from "@/data/mock-apps";

const statCards = [
  { label: "Active Apps", value: "4", icon: "apps", accent: "text-primary" },
  { label: "Pending Approvals", value: "12", icon: "pending_actions", accent: "text-amber-400" },
  { label: "AI Actions Today", value: "284", icon: "auto_awesome", accent: "text-primary" },
  { label: "Open Tickets", value: "8", icon: "confirmation_number", accent: "text-blue-400" },
];

export default function HomePage() {
  return (
    <>
      <TopBar
        title="The Intelligent Layer"
        breadcrumbs={[{ label: "Dashboard" }, { label: "Home" }]}
        actions={
          <Link href="/apps/new/ai">
            <Button variant="primary" size="md">
              <Icon name="auto_awesome" size="sm" filled />
              New AI App
            </Button>
          </Link>
        }
      />

      <main className="pt-16 px-10 py-10">
        {/* Hero */}
        <div className="mb-10">
          <h2 className="font-headline text-4xl font-extrabold text-white mb-2 tracking-tight">
            Welcome back, Marcus
          </h2>
          <p className="text-on-surface-variant">
            Build business apps with AI, run operations with AI, govern with confidence.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="bg-surface-container rounded-xl p-6 hover:bg-surface-container-high transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  {stat.label}
                </span>
                <Icon name={stat.icon} className={stat.accent} size="md" />
              </div>
              <div className="text-3xl font-headline font-extrabold text-white">
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Apps grid */}
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-headline text-2xl font-bold text-white">Your Apps</h3>
          <Link
            href="/apps/new/ai"
            className="text-primary text-sm font-bold flex items-center gap-1 hover:text-emerald-400"
          >
            <Icon name="add" size="sm" />
            Create with AI
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {mockApps.map((app) => (
            <Link
              key={app.id}
              href={`/run/${app.code}/tickets`}
              className="bg-surface-container rounded-xl p-6 hover:bg-surface-container-high transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon name={app.icon} className="text-primary" size="lg" />
                </div>
                <Badge variant={app.status === "published" ? "success" : "warning"}>
                  {app.status}
                </Badge>
              </div>
              <h4 className="font-headline font-bold text-white text-lg mb-1 group-hover:text-primary transition-colors">
                {app.name}
              </h4>
              <p className="text-xs text-on-surface-variant line-clamp-2">
                {app.description}
              </p>
            </Link>
          ))}
        </div>

        {/* AI Suggestions */}
        <div className="mt-12">
          <h3 className="font-headline text-2xl font-bold text-white mb-6">
            AI Suggestions
          </h3>
          <div className="bg-emerald-950/30 rounded-xl p-6 border border-primary/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center shrink-0">
                <Icon name="auto_awesome" className="text-primary" filled size="md" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-primary tracking-wider uppercase mb-1">
                  AI Recommendation
                </div>
                <p className="text-on-surface text-sm">
                  Your Customer Support Desk has 3 unresolved critical tickets. Consider
                  reviewing the escalation flow to auto-route similar issues in the future.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary">
                    Review now
                  </Button>
                  <Button size="sm" variant="ghost">
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

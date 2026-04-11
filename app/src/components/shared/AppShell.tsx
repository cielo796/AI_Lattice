"use client";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}

export function AppShell({ children, title, breadcrumbs, actions }: AppShellProps) {
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <TopBar title={title} breadcrumbs={breadcrumbs} actions={actions} />
      <main className="ml-64 pt-16 min-h-screen">{children}</main>
    </div>
  );
}

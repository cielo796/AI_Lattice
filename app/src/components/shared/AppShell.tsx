"use client";

import { ShellChromeProvider } from "./ShellChrome";
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
    <ShellChromeProvider>
      <div className="min-h-screen bg-surface-container-low">
        <Sidebar />
        <TopBar title={title} breadcrumbs={breadcrumbs} actions={actions} />
        <main className="min-h-screen pt-14 md:ml-64">{children}</main>
      </div>
    </ShellChromeProvider>
  );
}

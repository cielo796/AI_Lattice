"use client";

import { ShellChromeProvider } from "./ShellChrome";
import { Sidebar } from "./Sidebar";
import { ShellContent } from "./ShellContent";
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
        <ShellContent>
          <main className="min-h-screen pt-14">{children}</main>
        </ShellContent>
      </div>
    </ShellChromeProvider>
  );
}

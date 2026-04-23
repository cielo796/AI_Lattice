"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { listApps } from "@/lib/api/apps";
import type { App } from "@/types/app";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { useShellChrome } from "./ShellChrome";

const bottomItems = [
  { href: "#", icon: "help", label: "ヘルプ" },
  { href: "#", icon: "chat_bubble", label: "フィードバック" },
];

function resolveCurrentApp(pathname: string | null, apps: App[]) {
  if (!pathname) {
    return null;
  }

  const appRouteMatch = pathname.match(/^\/apps\/([^/]+)/);
  if (appRouteMatch) {
    return apps.find((app) => app.id === appRouteMatch[1]) ?? null;
  }

  const runtimeMatch = pathname.match(/^\/(?:run|m)\/([^/]+)/);
  if (runtimeMatch) {
    return apps.find((app) => app.code === runtimeMatch[1]) ?? null;
  }

  return null;
}

function isAppScopedPath(pathname: string | null) {
  return Boolean(pathname?.startsWith("/apps/") || pathname?.startsWith("/run/") || pathname?.startsWith("/m/"));
}

interface SidebarContentProps {
  pathname: string | null;
  onNavigate?: () => void;
  onClose?: () => void;
  mobile?: boolean;
}

function SidebarContent({
  pathname,
  onNavigate,
  onClose,
  mobile = false,
}: SidebarContentProps) {
  const router = useRouter();
  const [apps, setApps] = useState<App[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadAppsForSidebar() {
      try {
        setIsLoadingApps(true);
        const nextApps = await listApps();

        if (active) {
          setApps(nextApps);
        }
      } catch {
        if (active) {
          setApps([]);
        }
      } finally {
        if (active) {
          setIsLoadingApps(false);
        }
      }
    }

    void loadAppsForSidebar();

    return () => {
      active = false;
    };
  }, []);

  const currentApp = useMemo(() => resolveCurrentApp(pathname, apps), [apps, pathname]);
  const navItems = useMemo(
    () => [
      { href: "/home", icon: "apps", label: "アプリ" },
      ...(currentApp
        ? [
            {
              href: `/apps/${currentApp.id}/tables`,
              icon: "table_chart",
              label: "テーブル",
            },
            {
              href: `/apps/${currentApp.id}/workflows`,
              icon: "account_tree",
              label: "ワークフロー",
            },
          ]
        : []),
      { href: "/admin/audit-logs", icon: "admin_panel_settings", label: "管理" },
    ],
    [currentApp]
  );
  const showAppSwitcher = isAppScopedPath(pathname);

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Icon name="apps" className="text-white" size="sm" />
          </div>
          <div className="flex flex-col">
            <span className="font-headline text-lg font-bold leading-none text-white">
              AI Lattice
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
              v2.4.0
            </span>
          </div>
        </div>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-white"
            aria-label="ナビゲーションを閉じる"
          >
            <Icon name="close" size="md" />
          </button>
        )}
      </div>

      {showAppSwitcher && (
        <div className="mb-6 rounded-xl bg-surface-container p-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            現在のアプリ
          </div>
          <select
            value={currentApp?.id ?? ""}
            disabled={isLoadingApps || apps.length === 0}
            onChange={(event) => {
              const nextAppId = event.target.value;
              if (!nextAppId) {
                return;
              }

              router.push(`/apps/${nextAppId}/tables`);
              onNavigate?.();
            }}
            className="w-full rounded-lg bg-surface px-3 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {!currentApp && <option value="">アプリを選択</option>}
            {apps.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name}
              </option>
            ))}
          </select>

          <Link
            href="/apps/new/ai"
            onClick={onNavigate}
            className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-primary transition-colors hover:text-emerald-400"
          >
            <Icon name="auto_awesome" size="sm" />
            新しいアプリを作成
          </Link>
        </div>
      )}

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200",
                isActive
                  ? "translate-x-1 bg-surface-container font-bold text-white shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              )}
            >
              <Icon name={item.icon} size="md" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-1 border-t border-outline-variant/30 pt-4">
        {bottomItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <Icon name={item.icon} size="md" />
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { closeMobileNav, isMobileNavOpen } = useShellChrome();

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isMobileNavOpen]);

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col bg-[#0c1322] md:flex">
        <SidebarContent pathname={pathname} />
      </aside>

      {isMobileNavOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={closeMobileNav}
        >
          <aside
            className="h-full w-[min(18rem,85vw)] bg-[#0c1322] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <SidebarContent
              pathname={pathname}
              mobile
              onClose={closeMobileNav}
              onNavigate={closeMobileNav}
            />
          </aside>
        </div>
      )}
    </>
  );
}

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
      { href: "/admin/openai", icon: "key", label: "OpenAI 設定" },
      { href: "/admin/approvals", icon: "approval", label: "承認" },
      { href: "/admin/audit-logs", icon: "admin_panel_settings", label: "監査ログ" },
    ],
    [currentApp]
  );
  const showAppSwitcher = isAppScopedPath(pathname);

  return (
    <div className="flex h-full flex-col px-3 py-5">
      <div className="mb-5 flex items-start justify-between gap-3 px-2">
        <Link href="/home" onClick={onNavigate} className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
            <Icon name="hub" className="text-white" size="sm" />
          </div>
          <div className="flex flex-col">
            <span className="font-headline text-[15px] font-extrabold leading-none tracking-tight text-on-surface">
              AI Lattice
            </span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-on-surface-muted">
              v2.4.0
            </span>
          </div>
        </Link>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-sidebar-hover hover:text-on-surface"
            aria-label="ナビゲーションを閉じる"
          >
            <Icon name="close" size="md" />
          </button>
        )}
      </div>

      <Link
        href="/apps/new/ai"
        onClick={onNavigate}
        className="mx-2 mb-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-hover active:scale-[0.98]"
      >
        <Icon name="add" size="sm" />
        作成
      </Link>

      {showAppSwitcher && (
        <div className="mx-2 mb-4 rounded-lg border border-outline-variant bg-surface p-3">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-muted">
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
            className="w-full rounded-md border border-outline-variant bg-surface px-2 py-1.5 text-sm font-medium text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {!currentApp && <option value="">アプリを選択</option>}
            {apps.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav className="flex-1 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150",
                isActive
                  ? "bg-sidebar-active font-semibold text-on-primary-container"
                  : "text-on-surface-variant hover:bg-sidebar-hover hover:text-on-surface"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon
                name={item.icon}
                size="md"
                className={isActive ? "text-primary" : ""}
              />
              <span className="text-[13.5px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-0.5 border-t border-outline-variant pt-3">
        {bottomItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-on-surface-variant transition-colors hover:bg-sidebar-hover hover:text-on-surface"
          >
            <Icon name={item.icon} size="md" />
            <span className="text-[13.5px] font-medium">{item.label}</span>
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
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col bg-sidebar border-r border-outline-variant md:flex">
        <SidebarContent pathname={pathname} />
      </aside>

      {isMobileNavOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={closeMobileNav}
        >
          <aside
            className="h-full w-[min(18rem,85vw)] bg-sidebar border-r border-outline-variant shadow-2xl"
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

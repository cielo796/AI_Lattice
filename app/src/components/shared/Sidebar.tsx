"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getAppByCode, listApps } from "@/lib/api/apps";
import type { App } from "@/types/app";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { useGuideLauncher } from "@/components/guide/GuideProvider";
import { useShellChrome } from "./ShellChrome";

const bottomItems = [
  { type: "link" as const, href: "/settings/display", icon: "contrast", label: "表示設定" },
  { type: "guide" as const, icon: "help", label: "ヘルプ" },
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

function resolveRuntimeAppCode(pathname: string | null) {
  const runtimeMatch = pathname?.match(/^\/(?:run|m)\/([^/]+)/);
  return runtimeMatch ? decodeURIComponent(runtimeMatch[1]) : "";
}

function isAppScopedPath(pathname: string | null) {
  return Boolean(pathname?.startsWith("/apps/") || pathname?.startsWith("/run/") || pathname?.startsWith("/m/"));
}

function mergeApp(apps: App[], app: App) {
  return apps.some((currentApp) => currentApp.id === app.id)
    ? apps.map((currentApp) => (currentApp.id === app.id ? app : currentApp))
    : [app, ...apps];
}

function RibbonTooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-outline bg-surface px-2.5 py-1.5 text-xs font-semibold text-on-surface opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
      {label}
    </span>
  );
}

interface SidebarContentProps {
  pathname: string | null;
  initialApps?: App[];
  onNavigate?: () => void;
  onClose?: () => void;
  onToggleCollapsed?: () => void;
  collapsed?: boolean;
  mobile?: boolean;
}

function SidebarContent({
  pathname,
  initialApps = [],
  onNavigate,
  onClose,
  onToggleCollapsed,
  collapsed = false,
  mobile = false,
}: SidebarContentProps) {
  const router = useRouter();
  const { hasCurrentTour, startCurrentTour } = useGuideLauncher();
  const [apps, setApps] = useState<App[]>(initialApps);
  const [isLoadingApps, setIsLoadingApps] = useState(initialApps.length === 0);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function loadAppsForSidebar(attempt = 0) {
      try {
        setIsLoadingApps(true);
        const nextApps = await listApps();

        if (active) {
          setApps(nextApps);
        }
      } catch {
        if (active && attempt < 2) {
          retryTimer = setTimeout(() => {
            void loadAppsForSidebar(attempt + 1);
          }, 600 * (attempt + 1));
          return;
        }

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
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, []);

  const runtimeAppCode = useMemo(() => resolveRuntimeAppCode(pathname), [pathname]);
  const currentApp = useMemo(() => resolveCurrentApp(pathname, apps), [apps, pathname]);

  useEffect(() => {
    if (!runtimeAppCode || currentApp) {
      return;
    }

    let active = true;

    async function loadCurrentRuntimeApp() {
      try {
        const app = await getAppByCode(runtimeAppCode);

        if (active) {
          setApps((currentApps) => mergeApp(currentApps, app));
        }
      } catch {
        // Keep the global navigation usable even when the runtime app lookup fails.
      }
    }

    void loadCurrentRuntimeApp();

    return () => {
      active = false;
    };
  }, [currentApp, runtimeAppCode]);

  const navItems = useMemo(
    () => [
      { group: "業務", href: "/home", icon: "home", label: "ホーム" },
      { group: "業務", href: "/home#my-apps", icon: "apps", label: "アプリ" },
      { group: "業務", href: "/admin/approvals", icon: "approval", label: "承認" },
      { group: "業務", href: "/notifications", icon: "notifications", label: "通知" },
      { group: "つくる", href: "/apps/new/ai", icon: "auto_awesome", label: "AIで作成" },
      { group: "つくる", href: currentApp ? `/apps/${currentApp.id}/tables` : "/home?manage=tables#my-apps", icon: "table_chart", label: "テーブル" },
      { group: "つくる", href: currentApp ? `/apps/${currentApp.id}/workflows` : "/home?manage=workflows#my-apps", icon: "account_tree", label: "ワークフロー" },
      ...(currentApp ? [
        { group: "現在のアプリ", href: `/run/${currentApp.code}`, icon: "home_app_logo", label: "アプリトップ" },
        { group: "現在のアプリ", href: `/run/${currentApp.code}/dashboard`, icon: "dashboard", label: "ダッシュボード" },
        { group: "現在のアプリ", href: `/run/${currentApp.code}/approvals`, icon: "approval", label: "アプリ承認" },
        { group: "現在のアプリ", href: `/apps/${currentApp.id}/settings`, icon: "settings", label: "アプリ設定" },
        { group: "現在のアプリ", href: `/apps/${currentApp.id}/permissions`, icon: "shield_person", label: "権限設計" },
      ] : []),
      { group: "管理", href: "/admin/users", icon: "group", label: "ユーザー" },
      { group: "管理", href: "/admin/roles", icon: "admin_panel_settings", label: "ロール" },
      { group: "管理", href: "/admin/tenant", icon: "domain", label: "テナント" },
      { group: "管理", href: "/admin/openai", icon: "key", label: "AI設定" },
      { group: "管理", href: "/admin/prompt-templates", icon: "text_snippet", label: "Prompt Template" },
      { group: "管理", href: "/admin/ai-logs", icon: "auto_awesome", label: "AI実行ログ" },
      { group: "管理", href: "/admin/audit-logs", icon: "fact_check", label: "監査ログ" },
    ],
    [currentApp]
  );
  const showAppSwitcher = isAppScopedPath(pathname);

  return (
    <div
      className={cn(
        "flex h-full flex-col py-5 transition-[padding] duration-200 ease-out",
        collapsed ? "px-2" : "px-3"
      )}
    >
      <div
        className={cn(
          "mb-5 flex px-2",
          collapsed
            ? "flex-col items-center justify-center gap-2"
            : "items-start justify-between gap-3"
        )}
      >
        <Link
          href="/home"
          onClick={onNavigate}
          className={cn("flex items-center gap-2.5", collapsed && "justify-center")}
          aria-label="AI Lattice ホーム"
          title={collapsed ? "AI Lattice" : undefined}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-logo text-on-primary shadow-card">
            <Icon name="hub" className="text-on-primary" size="sm" />
          </div>
          <div className={cn("flex flex-col", collapsed && "sr-only")}>
            <span className="font-headline text-[15px] font-extrabold leading-none tracking-tight text-side-on-ink">
              AI Lattice
            </span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-side-muted">
              v2.4.0
            </span>
          </div>
        </Link>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-side-ink transition-colors hover:bg-sidebar-hover hover:text-side-on-ink"
            aria-label="ナビゲーションを閉じる"
          >
            <Icon name="close" size="md" />
          </button>
        )}
        {!mobile && onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex h-8 w-8 items-center justify-center rounded-full text-side-ink transition-colors hover:bg-sidebar-hover hover:text-side-on-ink"
            aria-label={collapsed ? "サイドメニューを開く" : "サイドメニューを閉じる"}
            title={collapsed ? "サイドメニューを開く" : "サイドメニューを閉じる"}
          >
            <Icon name={collapsed ? "chevron_right" : "chevron_left"} size="sm" />
          </button>
        )}
      </div>

      <Link
        href="/apps/new/ai"
        onClick={onNavigate}
        className={cn(
          "group relative mx-2 mb-4 inline-flex items-center justify-center gap-2 rounded-md border border-side-action bg-side-action text-sm font-semibold text-on-side-action shadow-card transition-all hover:brightness-95 active:scale-[0.98]",
          collapsed ? "h-10 w-10 px-0 py-0" : "px-3 py-2"
        )}
        aria-label="アプリを作成"
        title={collapsed ? "アプリを作成" : undefined}
        data-guide="sidebar-create-app"
      >
        <Icon name="add" size="sm" />
        {collapsed ? <RibbonTooltip label="作成" /> : <span>新しいアプリ</span>}
      </Link>

      {showAppSwitcher && !collapsed && (
        <div
          className="mx-2 mb-4 rounded-lg border border-side-border bg-sidebar-active p-3"
          data-guide="sidebar-app-switcher"
        >
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-side-muted">
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
            className="w-full rounded-md border border-side-border bg-surface px-2 py-1.5 text-sm font-medium text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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

      <nav
        className={cn("min-h-0 flex-1 overflow-y-auto space-y-0.5", collapsed && "space-y-1")}
        data-guide="sidebar-nav"
      >
        {navItems.map((item, index) => {
          const isRuntimeRoot = /^\/run\/[^/]+$/.test(item.href);
          const isActive = isRuntimeRoot
            ? pathname === item.href
            : !item.href.includes("#") && pathname?.startsWith(item.href);

          return (
            <div key={item.href}>
              {!collapsed && (index === 0 || navItems[index - 1].group !== item.group) && <div className="px-3 pb-1 pt-4 text-[10px] font-semibold text-side-muted">{item.group}</div>}
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex min-w-0 items-center rounded-lg transition-colors duration-150",
                collapsed
                  ? "mx-auto h-10 w-10 justify-center px-0 py-0"
                  : "gap-3 px-3 py-2",
                isActive
                  ? "bg-sidebar-active font-semibold text-side-on-ink"
                  : "text-side-ink hover:bg-sidebar-hover hover:text-side-on-ink"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-side-bar" />
              )}
              <Icon
                name={item.icon}
                size="md"
                className={isActive ? "text-side-on-ink" : ""}
              />
              {collapsed ? (
                <RibbonTooltip label={item.label} />
              ) : (
                <span className="min-w-0 truncate text-[13.5px] font-medium">
                  {item.label}
                </span>
              )}
            </Link>
            </div>
          );
        })}
      </nav>

      <div
        className={cn(
          "mt-auto space-y-0.5 border-t border-side-border pt-3",
          collapsed && "space-y-1"
        )}
      >
        {bottomItems.map((item) =>
          item.type === "guide" ? (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                startCurrentTour();
                onNavigate?.();
              }}
              disabled={!hasCurrentTour}
              aria-label={item.label}
              title={!hasCurrentTour ? "この画面のガイドは準備中です" : collapsed ? item.label : undefined}
              className={cn(
                "group relative flex w-full min-w-0 items-center rounded-lg text-left text-side-ink transition-colors hover:bg-sidebar-hover hover:text-side-on-ink disabled:cursor-not-allowed disabled:opacity-50",
                collapsed
                  ? "mx-auto h-10 w-10 justify-center px-0 py-0"
                  : "gap-3 px-3 py-2"
              )}
              data-guide="sidebar-help"
            >
              <Icon name={item.icon} size="md" />
              {collapsed ? (
                <RibbonTooltip label={item.label} />
              ) : (
                <span className="min-w-0 truncate text-[13.5px] font-medium">
                  {item.label}
                </span>
              )}
            </button>
          ) : (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex min-w-0 items-center rounded-lg text-side-ink transition-colors hover:bg-sidebar-hover hover:text-side-on-ink",
                collapsed
                  ? "mx-auto h-10 w-10 justify-center px-0 py-0"
                  : "gap-3 px-3 py-2"
              )}
            >
              <Icon name={item.icon} size="md" />
              {collapsed ? (
                <RibbonTooltip label={item.label} />
              ) : (
                <span className="min-w-0 truncate text-[13.5px] font-medium">
                  {item.label}
                </span>
              )}
            </Link>
          )
        )}
      </div>
    </div>
  );
}

interface SidebarProps {
  initialApps?: App[];
}

export function Sidebar({ initialApps = [] }: SidebarProps) {
  const pathname = usePathname();
  const {
    closeMobileNav,
    isMobileNavOpen,
    isSidebarCollapsed,
    toggleSidebarCollapsed,
  } = useShellChrome();

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
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-side-border bg-sidebar transition-[width] duration-200 ease-out md:flex",
          isSidebarCollapsed ? "w-[4.5rem]" : "w-[232px]"
        )}
        data-guide="app-sidebar"
      >
        <SidebarContent
          pathname={pathname}
          initialApps={initialApps}
          collapsed={isSidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />
      </aside>

      {isMobileNavOpen && (
        <div
          className="fixed inset-0 z-50 bg-scrim md:hidden"
          onClick={closeMobileNav}
        >
          <aside
            className="h-full w-[min(18rem,85vw)] bg-sidebar border-r border-side-border shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            data-guide="app-sidebar"
          >
            <SidebarContent
              pathname={pathname}
              initialApps={initialApps}
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

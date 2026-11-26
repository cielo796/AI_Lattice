"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getCurrentPermissions } from "@/lib/api/rbac";
import { getRuntimeTableMeta } from "@/lib/api/records";
import { getAppViewLinks } from "@/lib/app-navigation";
import { cn } from "@/lib/cn";
import {
  canSeeAppDesign,
  getAppDesignItems,
  getAppSectionItems,
  isNavItemActive,
  type AppRoute,
  type ShellNavItem,
} from "@/lib/shell-navigation";
import type { App, AppView } from "@/types/app";
import { AppSwitcher } from "./AppSwitcher";
import { Icon } from "./Icon";

const linkClass = "flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm focus-visible:ring-2 focus-visible:ring-primary";

function activeLinkClass(active: boolean) {
  return cn(
    linkClass,
    active ? "bg-primary-container font-semibold text-on-primary-container" : "text-on-surface hover:bg-surface-container"
  );
}

function AppNavLinks({ items, onNavigate }: { items: ShellNavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = isNavItemActive(item, pathname);
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              onNavigate={onNavigate}
              aria-current={active ? "page" : undefined}
              className={activeLinkClass(active)}
            >
              <Icon name={item.icon} className="shrink-0" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AppDesignNav({ appId, onNavigate }: { appId: string; onNavigate?: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getCurrentPermissions({ appId }).then(
      (permissions) => {
        if (!cancelled) setVisible(canSeeAppDesign(permissions));
      },
      () => {
        if (!cancelled) setVisible(false);
      }
    );
    return () => { cancelled = true; };
  }, [appId]);

  if (!visible) return null;

  return (
    <section className="border-t border-outline-variant pt-3">
      <h2 className="px-2 pb-1 text-xs font-semibold text-on-surface-variant">アプリの設計</h2>
      <AppNavLinks items={getAppDesignItems({ id: appId })} onNavigate={onNavigate} />
      <p className="px-2 pt-2 text-xs text-on-surface-variant">編集権限のある人にだけ表示します</p>
    </section>
  );
}

function ViewNav({ appCode, tableCode, onNavigate }: { appCode: string; tableCode: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [views, setViews] = useState<AppView[]>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getRuntimeTableMeta(appCode, tableCode).then(
      (meta) => {
        if (!cancelled) setViews(meta.views);
      },
      () => {
        if (!cancelled) setFailed(true);
      }
    );
    return () => { cancelled = true; };
  }, [appCode, tableCode]);

  return (
    <nav aria-label="ビュー" className="border-t border-outline-variant pt-3">
      <h2 className="px-2 pb-1 text-xs font-semibold text-on-surface-variant">ビュー</h2>
      {views ? (
        <ul className="space-y-1">
          {getAppViewLinks(views, pathname, searchParams).map((view) => (
            <li key={view.id}>
              <Link
                href={view.href}
                onNavigate={onNavigate}
                scroll={false}
                aria-current={view.active ? "page" : undefined}
                className={activeLinkClass(view.active)}
              >
                <Icon name="view_list" className="shrink-0" />
                {view.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="px-2 text-xs text-on-surface-variant">
          {failed ? "ビューを読み込めませんでした" : "読み込み中…"}
        </p>
      )}
    </nav>
  );
}

interface AppNavProps {
  route: AppRoute;
  currentApp: App | null;
  apps: App[];
  collapseButton?: ReactNode;
  onNavigate?: () => void;
}

export function AppNav({ route, currentApp, apps, collapseButton, onNavigate }: AppNavProps) {
  const appCode = currentApp?.code ?? route.appCode;
  const appId = currentApp?.id ?? route.appId;

  return (
    <aside className="flex min-h-0 flex-col border-t border-outline-variant bg-surface md:w-(--app-nav-width) md:border-t-0 md:border-r">
      <div className="flex shrink-0 items-center gap-1 p-3">
        <AppSwitcher currentApp={currentApp} apps={apps} onNavigate={onNavigate} />
        {collapseButton}
      </div>
      <nav aria-label="アプリメニュー" className="space-y-3 px-3 pb-3 md:overflow-y-auto">
        <section>
          <h2 className="px-2 pb-1 text-xs font-semibold text-on-surface-variant">アプリ</h2>
          {appCode && <AppNavLinks items={getAppSectionItems({ code: appCode })} onNavigate={onNavigate} />}
        </section>
        {route.kind === "runtime" && route.appCode && route.tableCode && (
          <ViewNav
            key={JSON.stringify([route.appCode, route.tableCode])}
            appCode={route.appCode}
            tableCode={route.tableCode}
            onNavigate={onNavigate}
          />
        )}
        {appId && <AppDesignNav key={appId} appId={appId} onNavigate={onNavigate} />}
      </nav>
    </aside>
  );
}

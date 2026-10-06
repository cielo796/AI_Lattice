"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { AppSearch } from "./AppSearch";
import { useDisplayTheme } from "./DisplayThemeProvider";
import { cn } from "@/lib/cn";
import { getUnreadNotificationCount } from "@/lib/api/notifications";
import { useAuthStore } from "@/stores/authStore";
import { useGuideLauncher } from "@/components/guide/GuideProvider";
import { useShellChrome } from "./ShellChrome";

interface TopBarProps {
  title?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}

export function TopBar({ title, breadcrumbs, actions }: TopBarProps) {
  const avatarName = useAuthStore((s) => s.user?.name ?? "Marcus Chen");
  const { settings } = useDisplayTheme();
  const userMenuId = useId();
  const { isSidebarCollapsed, toggleMobileNav } = useShellChrome();
  const { hasCurrentTour, currentTourLabel, startCurrentTour } = useGuideLauncher();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const actionsId = useId();
  const actionsRef = useRef<HTMLDivElement>(null);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isActionsOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !actionsRef.current?.contains(event.target)) {
        setIsActionsOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsActionsOpen(false);
        actionsButtonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isActionsOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadUnreadCount() {
      try {
        const result = await getUnreadNotificationCount();
        if (!cancelled) {
          setUnreadCount(result.count);
        }
      } catch {
        if (!cancelled) {
          setUnreadCount(0);
        }
      }
    }

    const timeoutId = window.setTimeout(() => void loadUnreadCount(), 3000);
    const intervalId = window.setInterval(() => void loadUnreadCount(), 60000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-30 flex h-[52px] items-center justify-between border-b border-outline-variant bg-surface px-3 transition-[left] duration-200 ease-out md:left-[232px] md:px-6",
        isSidebarCollapsed && "md:left-[4.5rem]"
      )}
      data-guide="topbar"
    >
      <div className="flex min-w-0 items-center gap-2 md:gap-5">
        <button
          type="button"
          onClick={toggleMobileNav}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface md:hidden"
          aria-label="ナビゲーションを開く"
        >
          <Icon name="menu" />
        </button>
        <nav aria-label="パンくず" className="flex min-w-0 items-center gap-1.5 text-xs">
          {breadcrumbs?.slice(0, -1).map((crumb) => (
            <span key={crumb.label} className="hidden items-center gap-1.5 lg:flex">
              {crumb.href ? <Link href={crumb.href} className="text-on-surface-variant hover:text-info">{crumb.label}</Link> : <span className="text-on-surface-variant">{crumb.label}</span>}
              <Icon name="chevron_right" className="text-on-surface-variant" size="sm" />
            </span>
          ))}
          <span aria-current="page" className="truncate text-[13px] font-semibold">{title ?? breadcrumbs?.at(-1)?.label}</span>
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        <AppSearch />
        {actions && (
          <div className="relative" ref={actionsRef}>
            <button
              ref={actionsButtonRef}
              type="button"
              onClick={() => setIsActionsOpen((current) => !current)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high lg:hidden"
              aria-label="操作メニュー"
              aria-expanded={isActionsOpen}
              aria-controls={actionsId}
            >
              <Icon name="more_vert" />
            </button>
            <div
              id={actionsId}
              className={cn(
                "absolute right-0 top-11 hidden w-max max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface p-3 shadow-lg lg:static lg:flex lg:max-w-none lg:flex-nowrap lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
                isActionsOpen && "flex"
              )}
              data-guide="topbar-actions"
              onClick={(event) => {
                if (event.target instanceof Element && event.target.closest("button:not(:disabled), a")) {
                  setIsActionsOpen(false);
                }
              }}
            >
              {actions}
            </div>
          </div>
        )}
        {hasCurrentTour && (
          <button
            type="button"
            onClick={startCurrentTour}
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            aria-label={`${currentTourLabel ?? "この画面"}の初心者ガイドを開始`}
            title={`${currentTourLabel ?? "この画面"}の初心者ガイド`}
            data-guide="topbar-guide-button"
          >
            <Icon name="help" />
          </button>
        )}
        <div className="relative hidden sm:block">
          <Link
            href="/notifications"
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            aria-label={`通知${unreadCount > 0 ? ` ${unreadCount}件未読` : ""}`}
          >
            <Icon name="notifications" />
          </Link>
          {unreadCount > 0 && (
            <span className="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-on-primary ring-2 ring-surface">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        <Link
          href="/settings/profile"
          className="hidden h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface md:flex"
          aria-label="設定"
        >
          <Icon name="settings" />
        </Link>
        <button type="button" popoverTarget={userMenuId} aria-label="ユーザーメニュー" className="ml-1 rounded-full"><Avatar name={avatarName} size="md" /></button>
        <div id={userMenuId} popover="auto" className="fixed left-auto right-3 top-14 m-0 w-52 rounded-md border border-outline-variant bg-surface p-2 text-xs text-on-surface shadow-popover">
          <p className="truncate border-b border-outline-variant px-2 py-2 font-semibold">{avatarName}</p>
          <Link href="/settings/profile" onClick={() => document.getElementById(userMenuId)?.hidePopover()} className="block rounded px-2 py-2 hover:bg-surface-container">プロフィール</Link>
          <Link href="/settings/display" onClick={() => document.getElementById(userMenuId)?.hidePopover()} className="block rounded px-2 py-2 hover:bg-surface-container">表示設定{settings.allowUserTheme ? "" : "（管理者が固定）"}</Link>
        </div>
      </div>
    </header>
  );
}

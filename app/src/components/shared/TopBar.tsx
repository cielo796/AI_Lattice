"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { getUnreadNotificationCount } from "@/lib/api/notifications";
import { useAuthStore } from "@/stores/authStore";
import { useShellChrome } from "./ShellChrome";

interface TopBarProps {
  title?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}

export function TopBar({ title, breadcrumbs, actions }: TopBarProps) {
  const avatarName = useAuthStore((s) => s.user?.name ?? "Marcus Chen");
  const { toggleMobileNav } = useShellChrome();
  const [unreadCount, setUnreadCount] = useState(0);

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
    <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-outline-variant bg-surface/90 px-3 backdrop-blur-md md:left-64 md:px-6">
      <div className="flex min-w-0 items-center gap-2 md:gap-5">
        <button
          type="button"
          onClick={toggleMobileNav}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface md:hidden"
          aria-label="ナビゲーションを開く"
        >
          <Icon name="menu" />
        </button>
        <div className="min-w-0">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="mb-0.5 hidden items-center gap-1.5 text-[11px] lg:flex">
              {breadcrumbs.slice(0, -1).map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className="font-medium text-on-surface-muted">
                    {crumb.label}
                  </span>
                  <Icon name="chevron_right" className="text-on-surface-muted" size="sm" />
                </span>
              ))}
            </div>
          )}
          {title && (
            <h1 className="truncate font-headline text-[17px] font-extrabold tracking-tight text-on-surface md:text-[19px]">
              {title}
            </h1>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2">
        {actions && (
          <div className="hidden items-center gap-2 lg:flex">
            {actions}
          </div>
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
            <span className="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface">
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
        <div className="ml-1 flex items-center">
          <Avatar name={avatarName} size="md" />
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useId, useRef } from "react";
import { useGuideLauncher } from "@/components/guide/GuideProvider";
import { cn } from "@/lib/cn";
import { ADMIN_RAIL_ITEM, canSeeAdmin, isNavItemActive, RAIL_ITEMS } from "@/lib/shell-navigation";
import { useAuthStore } from "@/stores/authStore";
import { Avatar } from "./Avatar";
import { useDisplayTheme } from "./DisplayThemeProvider";
import { Icon } from "./Icon";
import { useShellChrome } from "./ShellChrome";

const railControl = "rounded-lg text-side-ink hover:bg-sidebar-hover hover:text-side-on-ink focus-visible:ring-2 focus-visible:ring-side-bar";
const accountAction = "flex min-h-10 w-full items-center rounded-md px-2 text-left hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary";

interface GlobalRailProps {
  userName: string;
  unreadCount: number;
  hash: string;
  onNavigate?: () => void;
  onClose?: () => void;
  reopenAppNav?: React.ReactNode;
}

export function GlobalRail({
  userName,
  unreadCount,
  hash,
  onNavigate,
  onClose,
  reopenAppNav,
}: GlobalRailProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { permissions } = useShellChrome();
  const { settings } = useDisplayTheme();
  const { hasCurrentTour, startCurrentTour } = useGuideLauncher();
  const avatarName = useAuthStore((state) => state.user?.name ?? userName);
  const logout = useAuthStore((state) => state.logout);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const items = canSeeAdmin(permissions) ? [...RAIL_ITEMS, ADMIN_RAIL_ITEM] : RAIL_ITEMS;

  function closeAccountMenu() {
    menuRef.current?.hidePopover();
    onNavigate?.();
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // The auth store clears local session state even if the request fails.
    }
    closeAccountMenu();
    router.replace("/login");
  }

  return (
    <aside
      className="flex min-h-0 flex-col bg-sidebar text-side-ink md:w-(--rail-width) md:border-r md:border-side-border"
      data-guide="app-sidebar"
    >
      <div className="flex shrink-0 items-center justify-between px-3 py-2 md:justify-center md:px-0">
        <Link
          href="/home"
          onNavigate={onNavigate}
          aria-label="AI Lattice ホーム"
          className={cn(railControl, "flex min-h-10 min-w-10 items-center justify-center gap-2")}
        >
          <span className="flex size-8 items-center justify-center rounded-md bg-logo text-on-primary shadow-card">
            <Icon name="hub" size="sm" />
          </span>
          <span className="text-sm font-bold text-side-on-ink md:sr-only">AI Lattice</span>
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="ナビゲーションを閉じる"
            className={cn(railControl, "flex size-10 items-center justify-center")}
          >
            <Icon name="close" />
          </button>
        )}
      </div>

      <nav
        aria-label="メインメニュー"
        data-guide="sidebar-nav"
        className="grid grid-cols-5 gap-1 px-2 py-1 md:flex md:min-h-0 md:flex-1 md:flex-col md:items-center md:overflow-y-auto"
      >
        {items.map((item) => {
          const active = isNavItemActive(item, pathname, hash);
          const hasUnread = item.key === "notifications" && unreadCount > 0;
          return (
            <Link
              key={item.key}
              href={item.href}
              onNavigate={onNavigate}
              aria-current={active ? "page" : undefined}
              aria-label={hasUnread ? `通知 ${unreadCount}件未読` : undefined}
              className={cn(
                railControl,
                "relative flex min-h-14 shrink-0 flex-col items-center justify-center gap-0.5 text-xs md:w-14",
                active && "bg-sidebar-active font-semibold text-side-on-ink"
              )}
            >
              {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-side-bar" aria-hidden="true" />}
              <span className="relative flex">
                <Icon name={item.icon} />
                {hasUnread && (
                  <span aria-hidden="true" className="absolute -right-2 -top-1 min-w-4 rounded-full bg-side-action px-0.5 text-center text-[10px] font-bold text-on-side-action">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center justify-end gap-1 px-3 py-2 md:flex-col md:border-t md:border-side-border md:px-0">
        {reopenAppNav}
        <button
          type="button"
          popoverTarget={menuId}
          aria-label="ユーザーメニュー"
          className={cn(railControl, "flex size-10 items-center justify-center rounded-full")}
        >
          <Avatar name={avatarName} size="md" />
        </button>
        <div
          id={menuId}
          ref={menuRef}
          popover="auto"
          className="fixed inset-auto left-3 top-[anchor(bottom,10rem)] m-0 w-[min(15rem,calc(85vw-1.5rem))] max-h-[75dvh] overflow-y-auto rounded-lg border border-outline-variant bg-surface p-2 text-sm text-on-surface shadow-popover [position-try-fallbacks:flip-block] md:bottom-2 md:left-(--rail-width) md:top-auto"
        >
          <p className="truncate border-b border-outline-variant px-2 py-2 font-semibold">{avatarName}</p>
          <Link href="/settings/profile" onNavigate={closeAccountMenu} className={accountAction}>プロフィール</Link>
          <Link href="/settings/display" onNavigate={closeAccountMenu} className={accountAction}>
            表示設定{settings.allowUserTheme ? "" : "（管理者が固定）"}
          </Link>
          <button
            type="button"
            data-guide="sidebar-help"
            className={cn(accountAction, "disabled:opacity-50")}
            disabled={!hasCurrentTour}
            title={hasCurrentTour ? undefined : "この画面のガイドは準備中です"}
            onClick={() => {
              closeAccountMenu();
              window.requestAnimationFrame(startCurrentTour);
            }}
          >
            ヘルプ
          </button>
          <button type="button" onClick={() => void handleLogout()} className={accountAction}>
            ログアウト
          </button>
        </div>
      </div>
    </aside>
  );
}

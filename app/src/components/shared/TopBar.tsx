"use client";

import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
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

  return (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between bg-[#0c1322]/80 px-4 backdrop-blur-md md:left-64 md:px-8">
      <div className="flex min-w-0 items-center gap-3 md:gap-8">
        <button
          type="button"
          onClick={toggleMobileNav}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-white md:hidden"
          aria-label="ナビゲーションを開く"
        >
          <Icon name="menu" />
        </button>
        <div className="min-w-0">
          {title && (
            <h1 className="truncate font-headline text-lg font-extrabold tracking-tight text-white md:text-xl">
              {title}
            </h1>
          )}
          {breadcrumbs && (
            <div className="hidden items-center gap-2 text-sm lg:flex">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-on-surface-variant">/</span>}
                  <span
                    className={
                      i === breadcrumbs.length - 1
                        ? "font-semibold text-white"
                        : "text-on-surface-variant"
                    }
                  >
                    {crumb.label}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {actions && (
          <div className="hidden items-center gap-2 lg:flex">
            {actions}
          </div>
        )}
        <button className="hidden h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-white sm:flex">
          <Icon name="notifications" />
        </button>
        <button className="hidden h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-white md:flex">
          <Icon name="settings" />
        </button>
        <Avatar name={avatarName} size="md" />
      </div>
    </header>
  );
}

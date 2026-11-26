"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/shared/Icon";
import { useShellChrome } from "@/components/shared/ShellChrome";
import { cn } from "@/lib/cn";
import { getVisibleAdminTabs, isAdminTabPath, isNavItemActive } from "@/lib/shell-navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { permissions } = useShellChrome();
  const tabs = getVisibleAdminTabs(permissions);

  if (!isAdminTabPath(pathname) || tabs.length === 0) return children;

  return (
    <div className="min-w-0 max-md:pt-[52px] md:flex">
      <nav
        aria-label="管理メニュー"
        className="flex gap-1 overflow-x-auto border-b border-outline-variant bg-surface p-2 md:sticky md:top-20 md:mt-20 md:w-44 md:shrink-0 md:flex-col md:self-start md:rounded-r-lg md:border-y md:border-r"
      >
        {tabs.map((tab) => {
          const active = isNavItemActive(tab, pathname);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2 text-sm focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "bg-primary-container font-semibold text-on-primary-container"
                  : "text-on-surface hover:bg-surface-container"
              )}
            >
              <Icon name={tab.icon} size="sm" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="min-w-0 flex-1 max-md:[&_main]:pt-6">{children}</div>
    </div>
  );
}

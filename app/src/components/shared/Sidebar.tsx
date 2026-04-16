"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { useShellChrome } from "./ShellChrome";

const navItems = [
  { href: "/home", icon: "apps", label: "\u30a2\u30d7\u30ea" },
  { href: "/apps/app-001/tables", icon: "table_chart", label: "\u30c6\u30fc\u30d6\u30eb" },
  {
    href: "/apps/app-001/workflows",
    icon: "account_tree",
    label: "\u30ef\u30fc\u30af\u30d5\u30ed\u30fc",
  },
  { href: "/admin/ai-settings", icon: "psychology", label: "AI\u8a2d\u5b9a" },
  { href: "/admin/audit-logs", icon: "admin_panel_settings", label: "\u7ba1\u7406" },
];

const bottomItems = [
  { href: "#", icon: "help", label: "\u30d8\u30eb\u30d7" },
  {
    href: "#",
    icon: "chat_bubble",
    label: "\u30d5\u30a3\u30fc\u30c9\u30d0\u30c3\u30af",
  },
];

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
  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-8 flex items-start justify-between gap-3">
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
            aria-label="Close navigation"
          >
            <Icon name="close" size="md" />
          </button>
        )}
      </div>

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

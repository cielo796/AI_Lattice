"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

const navItems = [
  { href: "/home", icon: "apps", label: "Apps" },
  { href: "/apps/app-001/tables", icon: "table_chart", label: "Tables" },
  { href: "/apps/app-001/workflows", icon: "account_tree", label: "Workflows" },
  { href: "/admin/ai-settings", icon: "psychology", label: "AI Settings" },
  { href: "/admin/audit-logs", icon: "admin_panel_settings", label: "Admin" },
];

const bottomItems = [
  { href: "#", icon: "help", label: "Help" },
  { href: "#", icon: "chat_bubble", label: "Feedback" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 flex flex-col bg-[#0c1322] z-40">
      <div className="p-6 flex flex-col h-full">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Icon name="apps" className="text-white" size="sm" />
          </div>
          <div className="flex flex-col">
            <span className="font-headline font-bold text-lg text-white leading-none">
              Intelligent Layer
            </span>
            <span className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider">
              v2.4.0
            </span>
          </div>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                  isActive
                    ? "text-white font-bold bg-surface-container shadow-sm translate-x-1"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                )}
              >
                <Icon name={item.icon} size="md" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="mt-auto space-y-1 border-t border-outline-variant/30 pt-4">
          {bottomItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
            >
              <Icon name={item.icon} size="md" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}

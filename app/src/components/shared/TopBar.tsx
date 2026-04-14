"use client";

import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { useAuthStore } from "@/stores/authStore";

interface TopBarProps {
  title?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}

export function TopBar({ title, breadcrumbs, actions }: TopBarProps) {
  const avatarName = useAuthStore((s) => s.user?.name ?? "Marcus Chen");

  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-[#0c1322]/80 backdrop-blur-md flex items-center justify-between px-8 z-30">
      <div className="flex items-center gap-8">
        {title && (
          <h1 className="text-xl font-headline font-extrabold text-white tracking-tight">
            {title}
          </h1>
        )}
        {breadcrumbs && (
          <div className="hidden md:flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-on-surface-variant">/</span>}
                <span
                  className={
                    i === breadcrumbs.length - 1
                      ? "text-white font-semibold"
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

      <div className="flex items-center gap-4">
        {actions}
        <button className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-white transition-colors">
          <Icon name="notifications" />
        </button>
        <button className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-white transition-colors">
          <Icon name="settings" />
        </button>
        <Avatar name={avatarName} size="md" />
      </div>
    </header>
  );
}

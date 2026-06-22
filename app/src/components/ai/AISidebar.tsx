"use client";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/shared/Icon";

interface AISidebarProps {
  children?: React.ReactNode;
  title?: string;
  className?: string;
}

export function AISidebar({
  children,
  title = "AIアシスタント",
  className,
}: AISidebarProps) {
  return (
    <aside
      className={cn(
        "w-full shrink-0 border-l border-outline-variant bg-surface",
        className
      )}
    >
      <div className="border-b border-outline-variant px-5 pb-4 pt-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-tertiary text-white shadow-sm">
            <Icon name="auto_awesome" size="sm" filled />
          </span>
          <span className="text-[13px] font-semibold text-on-surface">
            {title}
          </span>
          <span className="ml-auto rounded-full bg-tertiary-container px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-on-tertiary-container">
            コンテキスト分析
          </span>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">{children}</div>
    </aside>
  );
}

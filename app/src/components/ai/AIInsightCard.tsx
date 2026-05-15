"use client";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/shared/Icon";

interface AIInsightCardProps {
  title?: string;
  children: React.ReactNode;
  icon?: string;
  className?: string;
}

export function AIInsightCard({
  title,
  children,
  icon = "auto_awesome",
  className,
}: AIInsightCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-tertiary-container bg-tertiary-container/40 p-4",
        className
      )}
    >
      {title && (
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-tertiary text-white shadow-sm">
            <Icon name={icon} size="sm" filled />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-on-tertiary-container">
            {title}
          </span>
        </div>
      )}
      <div className="text-[13.5px] leading-relaxed text-on-surface">{children}</div>
    </div>
  );
}

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
        "bg-emerald-950/30 rounded-lg p-4 border border-primary/20",
        className
      )}
    >
      {title && (
        <div className="flex items-center gap-2 mb-2">
          <Icon name={icon} size="sm" className="text-primary" filled />
          <span className="text-xs font-bold text-primary tracking-wider uppercase">
            {title}
          </span>
        </div>
      )}
      <div className="text-sm text-on-surface">{children}</div>
    </div>
  );
}

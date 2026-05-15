"use client";

import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: string;
}

export function Input({ className, icon, ...props }: InputProps) {
  const baseClass = cn(
    "w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] font-body text-on-surface",
    "placeholder:text-on-surface-muted",
    "transition-[box-shadow,border-color] duration-150",
    "hover:border-outline-strong",
    "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
    "disabled:cursor-not-allowed disabled:bg-surface-container disabled:text-on-surface-muted"
  );

  if (icon) {
    return (
      <div className="relative">
        <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-muted">
          {icon}
        </span>
        <input className={cn(baseClass, "pl-10", className)} {...props} />
      </div>
    );
  }

  return <input className={cn(baseClass, className)} {...props} />;
}

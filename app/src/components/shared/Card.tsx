"use client";

import { cn } from "@/lib/cn";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "glass";
}

export function Card({ children, className, variant = "default" }: CardProps) {
  const base = {
    default:
      "bg-surface rounded-xl border border-outline-variant p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_2px_4px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]",
    elevated:
      "bg-surface rounded-xl border border-outline-variant p-5 shadow-[0_2px_4px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]",
    glass: "glass-panel rounded-xl p-5",
  };

  return <div className={cn(base[variant], className)}>{children}</div>;
}

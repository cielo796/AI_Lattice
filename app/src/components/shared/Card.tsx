"use client";

import { cn } from "@/lib/cn";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "glass";
}

export function Card({ children, className, variant = "default" }: CardProps) {
  const base = {
    default: "bg-surface-container rounded-xl p-6",
    elevated: "bg-surface-container rounded-xl p-6 shadow-[0_12px_40px_rgba(11,28,48,0.06)]",
    glass: "glass-panel rounded-xl p-6",
  };

  return <div className={cn(base[variant], className)}>{children}</div>;
}

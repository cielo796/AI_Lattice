"use client";

import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "glass";
}

export function Card({ children, className, variant = "default", ...props }: CardProps) {
  const base = {
    default:
      "bg-surface rounded-xl border border-outline-variant p-5 shadow-card transition-shadow hover:shadow-card",
    elevated:
      "bg-surface rounded-xl border border-outline-variant p-5 shadow-card",
    glass: "glass-panel rounded-xl p-5",
  };

  return (
    <div className={cn(base[variant], className)} {...props}>
      {children}
    </div>
  );
}

"use client";

import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const variants = {
  primary:
    "bg-primary text-white hover:bg-emerald-600 active:scale-[0.98] transition-all duration-100",
  secondary:
    "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors",
  ghost:
    "text-on-surface-variant hover:bg-surface-container-highest/50 hover:text-on-surface transition-colors",
  danger:
    "bg-error/10 text-error hover:bg-error/20 transition-colors",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-lg font-bold inline-flex items-center justify-center gap-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

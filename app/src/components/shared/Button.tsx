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
    "bg-primary text-on-primary shadow-card hover:brightness-95 active:scale-[0.98] transition-all duration-100",
  secondary:
    "border border-outline bg-surface text-on-surface hover:bg-surface-container-high active:bg-surface-container-highest transition-colors",
  ghost:
    "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors",
  danger:
    "border border-error bg-surface text-error hover:bg-error-container active:scale-[0.98] transition-all",
};

const sizes = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-3.5 text-[13.5px]",
  lg: "h-11 px-5 text-sm",
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
        "inline-flex items-center justify-center gap-1.5 rounded-md font-semibold tracking-tight",
        "disabled:cursor-not-allowed disabled:bg-surface-container disabled:text-on-surface-muted",
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

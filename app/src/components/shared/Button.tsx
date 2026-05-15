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
    "bg-primary text-white shadow-sm hover:bg-primary-hover active:bg-primary-pressed active:scale-[0.98] transition-all duration-100",
  secondary:
    "border border-outline bg-surface text-on-surface hover:bg-surface-container-high active:bg-surface-container-highest transition-colors",
  ghost:
    "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors",
  danger:
    "bg-error text-white hover:bg-error/90 active:scale-[0.98] transition-all",
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
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

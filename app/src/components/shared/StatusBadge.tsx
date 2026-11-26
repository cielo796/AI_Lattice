"use client";

import type { JSX } from "react";
import { cn } from "@/lib/cn";
import { getStatusKind, type StatusKind } from "@/lib/record-status";
import { formatStatusLabel } from "@/lib/runtime-records";

const kindClasses: Record<StatusKind, string> = {
  neutral: "bg-surface-container-high text-on-surface-variant",
  warning: "bg-warning-container text-on-warning-container",
  success: "bg-success-container text-on-success-container",
  danger: "bg-error-container text-on-error-container",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}): JSX.Element {
  const label = formatStatusLabel(status);
  const statusKind = getStatusKind(status);
  const labelKind = getStatusKind(label);
  const kind = statusKind !== "neutral" ? statusKind : labelKind;

  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold leading-[18px]",
        kindClasses[kind],
        className
      )}
      data-status-kind={kind}
    >
      {label}
    </span>
  );
}

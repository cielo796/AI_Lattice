"use client";

import { cn } from "@/lib/cn";

interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "text-[16px]",
  md: "text-[20px]",
  lg: "text-[24px]",
};

export function Icon({ name, className, filled, size = "md" }: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined select-none", sizeMap[size], className)}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

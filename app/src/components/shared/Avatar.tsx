"use client";

import { cn } from "@/lib/cn";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
};

const colors = [
  "bg-[#f06a6a]",
  "bg-[#f9a7c2]",
  "bg-[#b8a0e8]",
  "bg-[#6ebeed]",
  "bg-[#4ecdc4]",
  "bg-[#6fd391]",
  "bg-[#f5d76e] text-[#6e4a14]",
  "bg-[#f8a26b]",
];

export function Avatar({ name, size = "md", className }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const colorIndex =
    name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white shrink-0 ring-2 ring-surface shadow-sm",
        sizeMap[size],
        colors[colorIndex],
        className
      )}
      title={name}
    >
      {initials}
    </div>
  );
}

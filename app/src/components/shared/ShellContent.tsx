"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { useShellChrome } from "./ShellChrome";

interface ShellContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ShellContent({ children, className }: ShellContentProps) {
  const { contentOffset } = useShellChrome();

  return (
    <div
      className={cn(
        "min-h-screen transition-[margin] duration-200 ease-out md:ml-(--shell-content-offset)",
        className
      )}
      style={{ "--shell-content-offset": `${contentOffset}px` } as CSSProperties}
      data-guide="page-content"
    >
      {children}
    </div>
  );
}

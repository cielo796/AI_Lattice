"use client";

import { cn } from "@/lib/cn";
import { useShellChrome } from "./ShellChrome";

interface ShellContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ShellContent({ children, className }: ShellContentProps) {
  const { isSidebarCollapsed } = useShellChrome();

  return (
    <div
      className={cn(
        "min-h-screen transition-[margin] duration-200 ease-out md:ml-[232px]",
        isSidebarCollapsed && "md:ml-[4.5rem]",
        className
      )}
      data-guide="page-content"
    >
      {children}
    </div>
  );
}

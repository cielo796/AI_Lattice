"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon";
import { AppSearch } from "./AppSearch";
import { cn } from "@/lib/cn";
import { useGuideLauncher } from "@/components/guide/GuideProvider";
import { useShellChrome } from "./ShellChrome";

interface TopBarProps {
  title?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}

export function TopBar({ title, breadcrumbs, actions }: TopBarProps) {
  const { openMobileNav } = useShellChrome();
  const { hasCurrentTour, currentTourLabel, startCurrentTour } = useGuideLauncher();
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const actionsId = useId();
  const actionsRef = useRef<HTMLDivElement>(null);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isActionsOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !actionsRef.current?.contains(event.target)) {
        setIsActionsOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsActionsOpen(false);
        actionsButtonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isActionsOpen]);

  return (
    <header
      className="fixed inset-x-0 top-0 z-30 flex h-[52px] items-center justify-between border-b border-outline-variant bg-surface px-3 transition-[left] duration-200 ease-out md:left-(--shell-content-offset) md:px-6"
      data-guide="topbar"
    >
      <div className="flex min-w-0 items-center gap-2 md:gap-5">
        <button
          type="button"
          onClick={openMobileNav}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary md:hidden"
          aria-label="ナビゲーションを開く"
        >
          <Icon name="menu" />
        </button>
        <nav aria-label="パンくず" className="flex min-w-0 items-center gap-1.5 text-xs">
          {breadcrumbs?.slice(0, -1).map((crumb) => (
            <span key={crumb.label} className="hidden items-center gap-1.5 lg:flex">
              {crumb.href ? <Link href={crumb.href} className="inline-flex min-h-10 items-center rounded text-on-surface-variant hover:text-info focus-visible:ring-2 focus-visible:ring-primary">{crumb.label}</Link> : <span className="text-on-surface-variant">{crumb.label}</span>}
              <Icon name="chevron_right" className="text-on-surface-variant" size="sm" />
            </span>
          ))}
          <span aria-current="page" className="truncate text-[13px] font-semibold">{title ?? breadcrumbs?.at(-1)?.label}</span>
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        <AppSearch />
        {actions && (
          <div className="relative" ref={actionsRef}>
            <button
              ref={actionsButtonRef}
              type="button"
              onClick={() => setIsActionsOpen((current) => !current)}
              className="flex size-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
              aria-label="操作メニュー"
              aria-expanded={isActionsOpen}
              aria-controls={actionsId}
            >
              <Icon name="more_vert" />
            </button>
            <div
              id={actionsId}
              className={cn(
                "absolute right-0 top-11 hidden w-max max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface p-3 shadow-lg lg:static lg:flex lg:max-w-none lg:flex-nowrap lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
                isActionsOpen && "flex"
              )}
              data-guide="topbar-actions"
              onClick={(event) => {
                if (event.target instanceof Element && event.target.closest("button:not(:disabled), a")) {
                  setIsActionsOpen(false);
                }
              }}
            >
              {actions}
            </div>
          </div>
        )}
        {hasCurrentTour && (
          <button
            type="button"
            onClick={startCurrentTour}
            className="flex size-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`${currentTourLabel ?? "この画面"}の初心者ガイドを開始`}
            title={`${currentTourLabel ?? "この画面"}の初心者ガイド`}
            data-guide="topbar-guide-button"
          >
            <Icon name="help" />
          </button>
        )}
      </div>
    </header>
  );
}

"use client";

import { useEffect, useEffectEvent, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getRecordDisplayNumber, getRecordTitle } from "@/lib/runtime-records";
import type { AppRecord } from "@/types/record";

const drawerQuery = "(width < 1200px)";

function subscribeToDrawerBreakpoint(onChange: () => void) {
  const query = window.matchMedia(drawerQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useRecordDrawer() {
  return useSyncExternalStore(
    subscribeToDrawerBreakpoint,
    () => window.matchMedia(drawerQuery).matches,
    () => false
  );
}

type RecordDetailPanelProps = {
  isDrawer: boolean;
  focusVersion: number;
  onClose: () => void;
  children: ReactNode;
} & ({ record: AppRecord; formTitle?: never } | { record?: never; formTitle: string });

export function RecordDetailPanel({
  isDrawer,
  focusVersion,
  record,
  formTitle,
  onClose,
  children,
}: RecordDetailPanelProps) {
  const headingId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.scrollTop = 0;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [focusVersion, formTitle, isDrawer]);

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (!isDrawer || event.key !== "Tab" || !panelRef.current) {
      return;
    }

    const panel = panelRef.current;
    const controls = Array.from(
      panel.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]")
    ).filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    const active = document.activeElement;
    if (!panel.contains(active) || (event.shiftKey && (active === first || active === headingRef.current))) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus();
    }
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      handleKeyDown(event);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {isDrawer && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[54] touch-none bg-on-surface/40 min-[1200px]:hidden"
          onClick={onClose}
        />
      )}
      <section
        ref={panelRef}
        role={isDrawer ? "dialog" : undefined}
        aria-modal={isDrawer || undefined}
        aria-labelledby={headingId}
        data-guide={record ? "runtime-record-detail" : undefined}
        className="fixed inset-y-0 right-0 z-[55] w-[380px] max-w-full overflow-y-auto overscroll-contain bg-surface text-sm shadow-card min-[1200px]:sticky min-[1200px]:inset-auto min-[1200px]:top-0 min-[1200px]:z-auto min-[1200px]:max-h-dvh min-[1200px]:shrink-0 min-[1200px]:self-start min-[1200px]:border-l min-[1200px]:border-outline-variant min-[1200px]:shadow-none"
      >
        <header className="space-y-2 px-4 pt-4">
          <div className="flex min-h-11 items-center justify-between gap-2">
            <span className="min-w-0 wrap-anywhere font-mono text-xs text-on-surface-variant">
              {record ? getRecordDisplayNumber(record) || record.id : null}
            </span>
            <Button type="button" variant="ghost" size="lg" className="w-11 shrink-0 px-0 focus-visible:ring-2 focus-visible:ring-primary" aria-label="詳細を閉じる" onClick={onClose}>
              <Icon name="close" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={headingId} ref={headingRef} tabIndex={-1} className="min-w-0 rounded wrap-anywhere text-xl font-bold leading-snug text-on-surface focus-visible:ring-2 focus-visible:ring-primary">
              {record ? getRecordTitle(record) : formTitle}
            </h2>
            {record && <StatusBadge status={record.status} />}
          </div>
        </header>
        {children}
      </section>
    </>
  );
}

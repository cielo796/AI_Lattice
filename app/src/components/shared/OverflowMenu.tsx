"use client";

import { useId, useRef, useState } from "react";
import { Icon } from "./Icon";

export function OverflowMenu({ label, children }: { label: string; children: React.ReactNode }) {
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label={label} aria-expanded={open} aria-controls={menuId} popoverTarget={menuId} onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({ top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 150)), left: Math.max(8, rect.right - 176) });
      }} className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container"><Icon name="more_horiz" size="sm" /></button>
      <div id={menuId} ref={menu} popover="auto" onToggle={(event) => setOpen(event.newState === "open")} onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("button:not(:disabled), a")) menu.current?.hidePopover();
      }} style={position} className="fixed m-0 w-44 rounded-md border border-outline-variant bg-surface p-1 text-xs text-on-surface shadow-popover">{children}</div>
    </>
  );
}

export function DeleteActionMenu({ name, onDelete }: { name: string; onDelete: () => void }) {
  return <OverflowMenu label={`${name}のその他の操作`}><button type="button" onClick={onDelete} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-error hover:bg-error-container"><Icon name="delete" size="sm" />削除</button></OverflowMenu>;
}

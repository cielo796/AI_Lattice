"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function CreationDialog({ title, onClose, children, drawer = false }: { title: string; onClose: () => void; children: ReactNode; drawer?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const handleEscape = (event: Event) => { event.preventDefault(); close.current(); };
    element?.addEventListener("cancel", handleEscape);
    return () => { element?.removeEventListener("cancel", handleEscape); element?.close(); };
  }, []);
  return <dialog ref={dialog} className={`ac-dialog${drawer ? " ac-drawer" : ""}`} aria-label={title}>
    <div className="ac-dialog-heading"><h2>{title}</h2><button type="button" className="ac-icon-button" aria-label="閉じる" onClick={onClose}>×</button></div>
    {children}
  </dialog>;
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { listApps } from "@/lib/api/apps";
import type { App } from "@/types/app";
import { Icon } from "./Icon";

export function AppSearch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    if (dialog.current?.open) { dialog.current.close(); return; }
    dialog.current?.showModal();
    input.current?.focus();
    setLoading(true);
    setError(null);
    try { setApps(await listApps()); } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "アプリを検索できませんでした。"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); void open(); }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  const normalized = query.toLocaleLowerCase();
  const matches = apps.filter((app) => [app.name, app.code, app.description].some((text) => text?.toLocaleLowerCase().includes(normalized)));
  return (
    <>
      <button type="button" onClick={() => void open()} className="hidden h-8 w-56 items-center gap-2 rounded-md border border-outline bg-surface px-2.5 text-xs text-on-surface-variant lg:flex" aria-label="アプリを検索"><Icon name="search" size="sm" /><span>アプリを検索</span><kbd className="ml-auto rounded border border-outline px-1 text-[10px]">⌘K</kbd></button>
      <button type="button" onClick={() => void open()} className="flex h-9 w-9 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container lg:hidden" aria-label="アプリを検索"><Icon name="search" /></button>
      <dialog ref={dialog} aria-label="アプリを検索" className="m-auto w-[min(560px,calc(100vw-2rem))] rounded-lg border border-outline-variant bg-surface p-4 text-on-surface shadow-popover backdrop:bg-scrim" onClick={(event) => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current?.close(); } }}>
        <div className="mb-3 flex items-center gap-2"><Icon name="search" className="text-on-surface-variant" /><input ref={input} aria-label="アプリ名・コード・説明で検索" placeholder="アプリ名・コード・説明で検索" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 rounded-md border border-outline bg-surface px-3 py-2 text-sm" /><button type="button" aria-label="検索を閉じる" onClick={() => dialog.current?.close()} className="rounded-md p-2 text-on-surface-variant hover:bg-surface-container"><Icon name="close" size="sm" /></button></div>
        <div className="max-h-80 overflow-auto">
          {loading ? <p role="status" className="p-3 text-sm text-on-surface-variant">検索対象を読み込んでいます...</p> : error ? <p role="alert" className="p-3 text-sm text-error">{error}</p> : matches.length ? matches.map((app) => <Link key={app.id} href={app.primaryTableCode ? `/run/${app.code}/${app.primaryTableCode}` : `/apps/${app.id}/tables`} onClick={() => dialog.current?.close()} className="flex items-center gap-3 rounded-md p-3 hover:bg-surface-container"><Icon name={app.icon || "apps"} className="text-on-surface-variant" /><div className="min-w-0"><div className="text-sm font-semibold">{app.name}</div><div className="truncate text-xs text-on-surface-variant">{app.description || app.code}</div></div></Link>) : <p className="p-3 text-sm text-on-surface-variant">該当するアプリはありません。</p>}
        </div>
      </dialog>
    </>
  );
}

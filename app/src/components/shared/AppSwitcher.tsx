"use client";

import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { moveAppSwitcherIndex } from "@/lib/app-navigation";
import { cn } from "@/lib/cn";
import type { App } from "@/types/app";
import { Icon } from "./Icon";

interface AppSwitcherProps {
  currentApp: App | null;
  apps: App[];
  onNavigate?: () => void;
}

export function AppSwitcher({ currentApp, apps, onNavigate }: AppSwitcherProps) {
  const panelId = useId();
  const listId = `${panelId}-apps`;
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedId, setHighlightedId] = useState<string>();
  const keyword = query.trim().toLocaleLowerCase();
  const matches = apps.filter((app) =>
    [app.name, app.code].some((value) => value.toLocaleLowerCase().includes(keyword))
  );
  const activeIndex = Math.max(0, matches.findIndex((app) => app.id === highlightedId));
  const activeOption = matches[activeIndex] ? `${listId}-${activeIndex}` : undefined;

  function close() {
    panel.current?.hidePopover();
    trigger.current?.focus({ preventScroll: true });
  }

  function navigate() {
    close();
    onNavigate?.();
  }

  function handleSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = moveAppSwitcherIndex(activeIndex, matches.length, event.key === "ArrowDown" ? 1 : -1);
      setHighlightedId(matches[nextIndex]?.id);
      document.getElementById(`${listId}-${nextIndex}`)?.scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter" && activeOption) {
      event.preventDefault();
      document.getElementById(activeOption)?.click();
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        data-guide="sidebar-app-switcher"
        popoverTarget={panelId}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-outline-variant px-2 text-left text-sm font-semibold text-on-surface hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon name={currentApp?.icon || "apps"} className="shrink-0 text-on-surface-variant" />
        <span className="flex-1 truncate">{currentApp?.name ?? "アプリを切り替え"}</span>
        <Icon name="unfold_more" size="sm" className="shrink-0 text-on-surface-variant" />
      </button>

      <div
        ref={panel}
        id={panelId}
        popover="auto"
        role="dialog"
        aria-label="アプリを切り替え"
        className="fixed inset-auto left-[anchor(left,0.75rem)] top-[anchor(bottom,8rem)] m-0 mt-1 w-[min(18rem,calc(85vw-1.5rem))] rounded-lg border border-outline-variant bg-surface text-on-surface shadow-popover [position-try-fallbacks:flip-block] md:left-[anchor(left,5.75rem)] md:top-[anchor(bottom,3.25rem)]"
        onToggle={(event) => {
          const open = event.currentTarget.matches(":popover-open");
          setIsOpen(open);
          if (open) input.current?.focus({ preventScroll: true });
          else {
            setQuery("");
            setHighlightedId(undefined);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
      >
        <div className="p-2">
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-label="アプリを検索"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-activedescendant={activeOption}
            placeholder="アプリ名・コード"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlightedId(undefined);
            }}
            onKeyDown={handleSearchKey}
            className="min-h-10 w-full rounded-md border border-outline bg-surface px-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <ul id={listId} role="listbox" aria-label="アプリ候補" className="max-h-[min(15rem,35dvh)] space-y-1 overflow-y-auto px-2 py-1">
          {matches.map((app, index) => (
            <li key={app.id} role="presentation">
              <Link
                id={`${listId}-${index}`}
                href={`/run/${encodeURIComponent(app.code)}`}
                onNavigate={navigate}
                role="option"
                tabIndex={-1}
                aria-selected={index === activeIndex}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-md px-2 text-sm hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary",
                  index === activeIndex && "bg-primary-container text-on-primary-container"
                )}
              >
                <Icon name={app.icon || "apps"} size="sm" className="shrink-0" />
                <span className="truncate">{app.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        {!matches.length && <p role="status" className="px-3 pb-2 text-sm text-on-surface-variant">該当するアプリはありません。</p>}
        <div className="border-t border-outline-variant p-2">
          <Link
            href="/apps/new/ai"
            onNavigate={navigate}
            data-guide="sidebar-create-app"
            className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-semibold text-primary hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="add" />
            アプリを作成
          </Link>
        </div>
      </div>
    </>
  );
}

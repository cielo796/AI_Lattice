"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { getAppByCode, listApps } from "@/lib/api/apps";
import { getUnreadNotificationCount } from "@/lib/api/notifications";
import { cn } from "@/lib/cn";
import { APP_NAV_WIDTH, GLOBAL_RAIL_WIDTH } from "@/lib/shell-layout";
import type { App } from "@/types/app";
import { AppNav } from "./AppNav";
import { GlobalRail } from "./GlobalRail";
import { Icon } from "./Icon";
import { useShellChrome } from "./ShellChrome";

const EMPTY_APPS: App[] = [];

function MobileNav({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const panel = dialog.current;
    const desktop = window.matchMedia("(min-width: 768px)");
    if (!panel) return;
    if (desktop.matches) {
      onClose();
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.showModal();
    function closeOnDesktop(event: MediaQueryListEvent) {
      if (event.matches) onClose();
    }
    desktop.addEventListener("change", closeOnDesktop);

    return () => {
      panel.close();
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialog}
      aria-label="ナビゲーション"
      className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none overflow-y-auto overscroll-contain bg-surface text-on-surface shadow-2xl backdrop:bg-scrim md:hidden"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="min-h-full">{children}</div>
    </dialog>
  );
}

export function Sidebar({
  initialApps = EMPTY_APPS,
  userName = "ユーザー",
}: {
  initialApps?: App[];
  userName?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    appRoute,
    closeMobileNav,
    isAppNavShown,
    isMobileNavOpen,
    toggleSidebarCollapsed,
  } = useShellChrome();
  const [hash, setHash] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadedApps, setLoadedApps] = useState<App[]>();
  const [runtimeApp, setRuntimeApp] = useState<App>();
  const desktopToggle = useRef<HTMLButtonElement>(null);
  const restoreToggleFocus = useRef(false);

  const appId = appRoute?.appId;
  const appCode = appRoute?.appCode;
  const apps = loadedApps ?? initialApps;
  const listedApp = apps.find((app) => appId ? app.id === appId : app.code === appCode);
  const fallbackApp = runtimeApp?.code === appCode ? runtimeApp : undefined;
  const currentApp = listedApp ?? fallbackApp ?? null;
  const switcherApps = !listedApp && fallbackApp ? [fallbackApp, ...apps] : apps;

  useEffect(() => {
    function handleLocationChange() {
      setHash(window.location.hash);
      closeMobileNav();
    }
    handleLocationChange();
    window.addEventListener("hashchange", handleLocationChange);
    return () => window.removeEventListener("hashchange", handleLocationChange);
  }, [pathname, searchParams, closeMobileNav]);

  useEffect(() => {
    let cancelled = false;
    async function loadUnreadCount() {
      try {
        const result = await getUnreadNotificationCount();
        if (!cancelled) setUnreadCount(result.count);
      } catch {
        if (!cancelled) setUnreadCount(0);
      }
    }
    const timeoutId = window.setTimeout(() => void loadUnreadCount(), 3000);
    const intervalId = window.setInterval(() => void loadUnreadCount(), 60000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!appId && !appCode) return;
    let cancelled = false;
    void listApps().then(
      (nextApps) => {
        if (!cancelled) setLoadedApps(nextApps);
      },
      () => { /* Keep the last successful list. */ }
    );
    return () => { cancelled = true; };
  }, [appId, appCode]);

  useEffect(() => {
    if (!appCode || currentApp) return;
    let cancelled = false;
    void getAppByCode(appCode).then(
      (app) => {
        if (!cancelled) setRuntimeApp(app);
      },
      () => { /* The global navigation remains available. */ }
    );
    return () => { cancelled = true; };
  }, [appCode, currentApp]);

  useLayoutEffect(() => {
    if (restoreToggleFocus.current) {
      desktopToggle.current?.focus({ preventScroll: true });
      restoreToggleFocus.current = false;
    }
  }, [isAppNavShown]);

  const collapseButton = appRoute && (
    <button
      ref={desktopToggle}
      type="button"
      aria-label={isAppNavShown ? "アプリメニューを閉じる" : "アプリメニューを開く"}
      aria-expanded={isAppNavShown}
      onClick={() => {
        restoreToggleFocus.current = true;
        toggleSidebarCollapsed();
      }}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg focus-visible:ring-2",
        isAppNavShown
          ? "text-on-surface-variant hover:bg-surface-container focus-visible:ring-primary"
          : "text-side-ink hover:text-side-on-ink focus-visible:ring-side-bar"
      )}
    >
      <Icon name={isAppNavShown ? "left_panel_close" : "left_panel_open"} />
    </button>
  );

  return (
    <>
      <div
        className="fixed inset-y-0 left-0 z-40 hidden md:flex"
        style={{ "--rail-width": `${GLOBAL_RAIL_WIDTH}px`, "--app-nav-width": `${APP_NAV_WIDTH}px` } as CSSProperties}
      >
        <GlobalRail
          userName={userName}
          unreadCount={unreadCount}
          hash={hash}
          reopenAppNav={isAppNavShown ? undefined : collapseButton}
        />
        {appRoute && isAppNavShown && !isMobileNavOpen && (
          <AppNav route={appRoute} currentApp={currentApp} apps={switcherApps} collapseButton={collapseButton} />
        )}
      </div>
      {isMobileNavOpen && (
        <MobileNav onClose={closeMobileNav}>
          <GlobalRail
            userName={userName}
            unreadCount={unreadCount}
            hash={hash}
            onNavigate={closeMobileNav}
            onClose={closeMobileNav}
          />
          {appRoute && (
            <AppNav route={appRoute} currentApp={currentApp} apps={switcherApps} onNavigate={closeMobileNav} />
          )}
        </MobileNav>
      )}
    </>
  );
}

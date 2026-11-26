"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { parseAppRoute, type AppRoute, type PermissionMap } from "@/lib/shell-navigation";
import { getShellContentOffset } from "@/lib/shell-layout";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "ai-lattice:sidebar-collapsed:v1";
const EMPTY_PERMISSIONS: PermissionMap = {};

interface ShellChromeContextValue {
  appRoute: AppRoute | null;
  isAppNavShown: boolean;
  contentOffset: number;
  permissions: PermissionMap;
  isMobileNavOpen: boolean;
  isSidebarCollapsed: boolean;
  closeMobileNav: () => void;
  openMobileNav: () => void;
  toggleMobileNav: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
}

const ShellChromeContext = createContext<ShellChromeContextValue | null>(null);

export function ShellChromeProvider({
  children,
  permissions = EMPTY_PERMISSIONS,
}: {
  children: ReactNode;
  permissions?: PermissionMap;
}) {
  const pathname = usePathname();
  const appRoute = useMemo(() => parseAppRoute(pathname), [pathname]);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsedState] = useState(false);
  const isAppNavShown = appRoute !== null && !isSidebarCollapsed;
  const closeMobileNav = useCallback(() => setIsMobileNavOpen(false), []);
  const [hasLoadedSidebarPreference, setHasLoadedSidebarPreference] =
    useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      if (stored !== null) {
        setIsSidebarCollapsedState(stored === "1");
      }
    } catch {
      // Keep the shell usable when browser storage is unavailable.
    } finally {
      setHasLoadedSidebarPreference(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedSidebarPreference) {
      return;
    }

    try {
      window.localStorage.setItem(
        SIDEBAR_COLLAPSED_STORAGE_KEY,
        isSidebarCollapsed ? "1" : "0"
      );
    } catch {
      // Preference persistence is best-effort.
    }
  }, [hasLoadedSidebarPreference, isSidebarCollapsed]);

  const value = useMemo<ShellChromeContextValue>(
    () => ({
      appRoute,
      isAppNavShown,
      contentOffset: getShellContentOffset(isAppNavShown),
      permissions,
      isMobileNavOpen,
      isSidebarCollapsed,
      closeMobileNav,
      openMobileNav: () => setIsMobileNavOpen(true),
      toggleMobileNav: () =>
        setIsMobileNavOpen((current) => !current),
      setSidebarCollapsed: setIsSidebarCollapsedState,
      toggleSidebarCollapsed: () =>
        setIsSidebarCollapsedState((current) => !current),
    }),
    [appRoute, closeMobileNav, isAppNavShown, isMobileNavOpen, isSidebarCollapsed, permissions]
  );

  return (
    <ShellChromeContext.Provider value={value}>
      {children}
    </ShellChromeContext.Provider>
  );
}

export function useShellChrome() {
  const value = useContext(ShellChromeContext);

  if (!value) {
    throw new Error("useShellChrome must be used within ShellChromeProvider");
  }

  return value;
}

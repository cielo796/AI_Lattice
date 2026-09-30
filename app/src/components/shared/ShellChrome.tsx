"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "ai-lattice:sidebar-collapsed:v1";

interface ShellChromeContextValue {
  isMobileNavOpen: boolean;
  isSidebarCollapsed: boolean;
  closeMobileNav: () => void;
  openMobileNav: () => void;
  toggleMobileNav: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
}

const ShellChromeContext = createContext<ShellChromeContextValue | null>(null);

export function ShellChromeProvider({ children }: { children: ReactNode }) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsedState] = useState(false);
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
      isMobileNavOpen,
      isSidebarCollapsed,
      closeMobileNav: () => setIsMobileNavOpen(false),
      openMobileNav: () => setIsMobileNavOpen(true),
      toggleMobileNav: () =>
        setIsMobileNavOpen((current) => !current),
      setSidebarCollapsed: setIsSidebarCollapsedState,
      toggleSidebarCollapsed: () =>
        setIsSidebarCollapsedState((current) => !current),
    }),
    [isMobileNavOpen, isSidebarCollapsed]
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

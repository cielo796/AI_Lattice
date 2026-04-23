"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface ShellChromeContextValue {
  isMobileNavOpen: boolean;
  closeMobileNav: () => void;
  openMobileNav: () => void;
  toggleMobileNav: () => void;
}

const ShellChromeContext = createContext<ShellChromeContextValue | null>(null);

export function ShellChromeProvider({ children }: { children: ReactNode }) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const value = useMemo<ShellChromeContextValue>(
    () => ({
      isMobileNavOpen,
      closeMobileNav: () => setIsMobileNavOpen(false),
      openMobileNav: () => setIsMobileNavOpen(true),
      toggleMobileNav: () =>
        setIsMobileNavOpen((current) => !current),
    }),
    [isMobileNavOpen]
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

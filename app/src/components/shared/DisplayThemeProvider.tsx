"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/stores/authStore";
import { resolveDisplayTheme, type DisplayPreference, type DisplaySettings, type TenantTheme } from "@/lib/display-theme";

type DisplayUpdate = { preference: DisplayPreference | null } | { defaultTheme?: TenantTheme; allowUserTheme?: boolean };
interface DisplayContextValue {
  settings: DisplaySettings;
  saving: boolean;
  update: (values: DisplayUpdate) => Promise<void>;
}
const DisplayContext = createContext<DisplayContextValue | null>(null);

function applyTheme(settings: DisplaySettings) {
  document.documentElement.dataset.theme = resolveDisplayTheme(settings, window.matchMedia("(prefers-color-scheme: dark)").matches);
}

export function DisplayThemeProvider({ initialSettings, children }: { initialSettings: DisplaySettings; children: React.ReactNode }) {
  const [settings, setSettings] = useState(initialSettings);
  const userId = useAuthStore((state) => state.user?.id);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const refreshVersion = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const refresh = useCallback(async () => {
    if (pending.current) return;
    const version = ++refreshVersion.current;
    try {
      const next = await apiFetch<DisplaySettings>("/api/settings/display", { cache: "no-store" });
      if (pending.current || version !== refreshVersion.current) return;
      setSettings(next);
      applyTheme(next);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    applyTheme(settings);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const change = () => applyTheme(settingsRef.current);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [settings]);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 60000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, userId]);

  async function update(values: DisplayUpdate) {
    if (pending.current) return;
    pending.current = true;
    refreshVersion.current++;
    setSaving(true);
    const previous = settings;
    const optimistic = { ...settings, ...values };
    setSettings(optimistic);
    applyTheme(optimistic);
    try {
      const next = await apiFetch<DisplaySettings>("/api/settings/display", { method: "PATCH", body: JSON.stringify(values) });
      setSettings(next);
      applyTheme(next);
    } catch (error) {
      setSettings(previous);
      applyTheme(previous);
      pending.current = false;
      await refresh();
      throw error;
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return <DisplayContext.Provider value={{ settings, saving, update }}>{children}</DisplayContext.Provider>;
}

export function useDisplayTheme() {
  const context = useContext(DisplayContext);
  if (!context) throw new Error("DisplayThemeProvider is required");
  return context;
}

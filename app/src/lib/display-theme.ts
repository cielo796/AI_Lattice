export const displayThemes = ["navy", "white", "dark", "system"] as const;
export type DisplayPreference = (typeof displayThemes)[number];
export type DisplayTheme = Exclude<DisplayPreference, "system">;
export type TenantTheme = Exclude<DisplayTheme, "dark">;

export interface DisplaySettings {
  preference: DisplayPreference | null;
  defaultTheme: TenantTheme;
  allowUserTheme: boolean;
  canManageTenant: boolean;
}

export const defaultDisplaySettings: DisplaySettings = {
  preference: null,
  defaultTheme: "navy",
  allowUserTheme: true,
  canManageTenant: false,
};

export function isDisplayPreference(value: unknown): value is DisplayPreference {
  return displayThemes.some((theme) => theme === value);
}

export function isTenantTheme(value: unknown): value is TenantTheme {
  return value === "navy" || value === "white";
}

export function resolveDisplayTheme(settings: DisplaySettings, prefersDark = false): DisplayTheme {
  const fallback = isTenantTheme(settings.defaultTheme) ? settings.defaultTheme : "navy";
  if (!settings.allowUserTheme || !isDisplayPreference(settings.preference)) return fallback;
  if (settings.preference === "system") return prefersDark ? "dark" : fallback;
  return settings.preference;
}

export function displayThemeBootstrap(settings: DisplaySettings) {
  if (!settings.allowUserTheme || settings.preference !== "system") return null;
  return `document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":${JSON.stringify(resolveDisplayTheme(settings))};`;
}

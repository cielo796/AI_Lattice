import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { defaultDisplaySettings, displayThemeBootstrap, isDisplayPreference, isTenantTheme, resolveDisplayTheme } from "./display-theme";

describe("display theme precedence", () => {
  it("uses navy for an unset preference and the tenant default for new accounts", () => {
    expect(resolveDisplayTheme(defaultDisplaySettings)).toBe("navy");
    expect(resolveDisplayTheme({ ...defaultDisplaySettings, defaultTheme: "white" })).toBe("white");
  });
  it.each(["navy", "white", "dark"] as const)("uses the personal %s preference when permitted", (preference) => {
    expect(resolveDisplayTheme({ ...defaultDisplaySettings, preference })).toBe(preference);
  });
  it.each(["navy", "white"] as const)("ignores dark and OS preferences when locked to %s", (defaultTheme) => {
    expect(resolveDisplayTheme({ ...defaultDisplaySettings, defaultTheme, preference: "dark", allowUserTheme: false }, true)).toBe(defaultTheme);
    expect(resolveDisplayTheme({ ...defaultDisplaySettings, defaultTheme, preference: "system", allowUserTheme: false }, true)).toBe(defaultTheme);
  });
  it("uses OS dark and otherwise the tenant default rather than white", () => {
    const settings = { ...defaultDisplaySettings, preference: "system" as const };
    expect(resolveDisplayTheme(settings, true)).toBe("dark");
    expect(resolveDisplayTheme(settings, false)).toBe("navy");
    expect(resolveDisplayTheme({ ...settings, defaultTheme: "white" }, false)).toBe("white");
  });
  it("limits personal and tenant values", () => {
    for (const value of ["navy", "white", "dark", "system"]) expect(isDisplayPreference(value)).toBe(true);
    for (const value of [undefined, null, {}, "", "pink", "<script>"]) expect(isDisplayPreference(value)).toBe(false);
    expect(isTenantTheme("dark")).toBe(false);
    expect(isTenantTheme("system")).toBe(false);
  });
  it("updates the OS theme before paint and does not inject a script for locked themes", () => {
    const settings = { ...defaultDisplaySettings, preference: "system" as const };
    for (const prefersDark of [true, false]) {
      const document = { documentElement: { dataset: { theme: "navy" } } };
      runInNewContext(displayThemeBootstrap(settings)!, { document, matchMedia: () => ({ matches: prefersDark }) });
      expect(document.documentElement.dataset.theme).toBe(prefersDark ? "dark" : "navy");
    }
    expect(displayThemeBootstrap(defaultDisplaySettings)).toBeNull();
    expect(displayThemeBootstrap({ ...settings, allowUserTheme: false })).toBeNull();
  });
});

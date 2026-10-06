import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const tokenFile = readFileSync(path.join(process.cwd(), "src/app/tokens.css"), "utf8");
function themeTokens(theme: string) {
  const block = tokenFile.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]+)`))![1];
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
}
function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(foreground: string, background: string) {
  const foregroundLight = luminance(foreground), backgroundLight = luminance(background);
  return (Math.max(foregroundLight, backgroundLight) + 0.05) / (Math.min(foregroundLight, backgroundLight) + 0.05);
}

describe("global design tokens", () => {
  it.each(["navy", "white", "dark"])("%s meets contrast for text, states, sidebar and controls", (theme) => {
    const tokens = themeTokens(theme);
    const surfaces = ["surface-page", "surface-card", "surface-sunken"];
    for (const surface of surfaces) {
      for (const ink of ["ink", "ink-muted", "ink-subtle"]) expect(contrast(tokens[ink], tokens[surface]), `${theme}: ${ink}/${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens["border-control"], tokens[surface])).toBeGreaterThanOrEqual(3);
    }
    for (const [ink, surface] of [["on-brand", "brand-strong"], ["brand-ink", "brand-tint"], ["success", "success-tint"], ["warning", "warning-tint"], ["danger", "danger-tint"], ["side-ink", "side"], ["side-muted", "side"], ["side-on-ink", "side-on-bg"], ["on-side-action", "side-action"]]) {
      expect(contrast(tokens[ink], tokens[surface]), `${theme}: ${ink}/${surface}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(tokens["side-bar"], tokens["side-on-bg"])).toBeGreaterThanOrEqual(3);
  });
  it("keeps all literal UI colors inside tokens.css", () => {
    const violations: string[] = [];
    function inspect(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) inspect(filename);
        else if (/\.(tsx?|css)$/.test(entry.name) && !entry.name.includes(".test.") && entry.name !== "tokens.css") {
          const content = readFileSync(filename, "utf8");
          if (entry.name !== "Sidebar.tsx" && /\bbg-sidebar\b/.test(content)) violations.push(path.relative(process.cwd(), filename));
          if (/#(?:[a-f\d]{6}|[a-f\d]{3})\b|\brgba?\(\s*[\d.]|\b(?:text|bg|border)-(?:pink|rose|purple|violet|blue|red|green|amber|yellow|white|black)-?\d*\b/i.test(content)) violations.push(path.relative(process.cwd(), filename));
        }
      }
    }
    inspect(path.join(process.cwd(), "src"));
    expect(violations).toEqual([]);
  });
});

"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { displayThemes, type DisplayPreference, type TenantTheme } from "@/lib/display-theme";
import { useDisplayTheme } from "./DisplayThemeProvider";
import { Icon } from "./Icon";
import { useClientReady } from "./useClientReady";

const options: Record<DisplayPreference, { label: string; description: string }> = {
  navy: { label: "ネイビー", description: "サイドバーが紺色の、業務向けの表示です。" },
  white: { label: "ホワイト", description: "サイドバーも白。明るく軽い印象です。" },
  dark: { label: "ダーク", description: "暗い場所や長時間の作業向けです。" },
  system: { label: "OSの設定に合わせる", description: "明るいときはテナントの既定、暗いときはダーク。" },
};

export function ThemePreview({ theme }: { theme: DisplayPreference }) {
  return (
    <span className="theme-preview" aria-hidden="true">
      {(theme === "system" ? ["navy", "dark"] : [theme]).map((preview) => (
        <span data-theme={preview} className="theme-preview-part" key={preview}>
          <span className="theme-preview-sidebar"><span /><span /><span /><span /></span>
          <span className="theme-preview-main"><span /><span /><span className="theme-preview-button" /></span>
        </span>
      ))}
    </span>
  );
}

export function DisplaySettingsPanel({ tenantOnly = false }: { tenantOnly?: boolean }) {
  const { settings, saving, update } = useDisplayTheme();
  const ready = useClientReady();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function change(values: Parameters<typeof update>[0]) {
    setSaved(false);
    setError(null);
    try {
      await update(values);
      setSaved(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "表示設定を保存できませんでした。");
    }
  }

  return (
    <div className="space-y-4" id="display-settings">
      {!tenantOnly && (
        <section className="rounded-lg border border-outline-variant bg-surface p-5 md:p-6" aria-labelledby="display-heading">
          <h2 id="display-heading" className="text-base font-bold">表示設定</h2>
          <p className="mt-1 text-xs text-on-surface-variant">この端末だけでなく、あなたのアカウントに保存されます。変更はすぐに反映されます。</p>
          {settings.allowUserTheme ? (
            <fieldset className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" disabled={saving || !ready}>
              <legend className="sr-only">表示テーマ</legend>
              {displayThemes.map((theme) => (
                <label key={theme} className={cn("theme-option", (settings.preference ?? settings.defaultTheme) === theme && "is-selected")}>
                  <ThemePreview theme={theme} />
                  <span className="mt-2 flex items-center gap-2 text-sm font-semibold">
                    <input type="radio" name="display-theme" value={theme} checked={(settings.preference ?? settings.defaultTheme) === theme} onChange={() => void change({ preference: theme })} />
                    {options[theme].label}
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed text-on-surface-variant">{options[theme].description}</span>
                </label>
              ))}
              <div className="col-span-full flex flex-wrap items-center gap-3 text-xs">
                <span className="text-on-surface-variant">テナントの既定: {options[settings.defaultTheme].label}</span>
                {settings.preference !== null && <button type="button" className="text-info underline underline-offset-2" onClick={() => void change({ preference: null })}>テナントの既定に戻す</button>}
              </div>
            </fieldset>
          ) : <p className="mt-4 flex items-center gap-2 rounded-md bg-surface-container p-3 text-sm text-on-surface-variant"><Icon name="lock" size="sm" />管理者により{options[settings.defaultTheme].label}に固定されています。</p>}
        </section>
      )}
      {settings.canManageTenant && (
        <section className="rounded-lg border border-outline-variant bg-surface p-5 md:p-6" aria-labelledby="tenant-display-heading">
          <div className="flex items-center justify-between">
            <h2 id="tenant-display-heading" className="text-base font-bold">既定の表示</h2>
            <span className="rounded-full bg-surface-container px-2 py-1 text-xs text-on-surface-variant">管理者</span>
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">表示を選んでいないユーザーに使われます。</p>
          <fieldset disabled={saving || !ready} className="mt-4 flex flex-wrap items-center gap-6">
            <legend className="sr-only">テナントの既定の表示</legend>
            {(["navy", "white"] as TenantTheme[]).map((theme) => <label className="flex items-center gap-2 text-sm" key={theme}><input type="radio" name="tenant-theme" checked={settings.defaultTheme === theme} onChange={() => void change({ defaultTheme: theme })} />{options[theme].label}{theme === "navy" && "（推奨）"}</label>)}
            <label className="flex items-center gap-2 text-sm md:ml-auto"><input type="checkbox" role="switch" checked={settings.allowUserTheme} onChange={(event) => void change({ allowUserTheme: event.target.checked })} />ユーザーが表示を変更できる</label>
          </fieldset>
          <p className="mt-3 text-xs text-on-surface-variant">ダークは個人の好みのため、テナントの既定には選べません。</p>
        </section>
      )}
      <div aria-live="polite" role="status" className={cn("text-xs", error ? "text-error" : "text-on-surface-variant")}>{error ?? (!ready ? "表示設定を準備しています..." : saving ? "保存中..." : saved ? "表示設定を保存しました。" : "")}</div>
    </div>
  );
}

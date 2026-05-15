"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { TopBar } from "@/components/shared/TopBar";
import {
  clearOpenAISettings,
  getOpenAISettings,
  saveOpenAISettings,
} from "@/lib/api/openai-settings";
import type { OpenAISettingsStatus } from "@/types/settings";

const sourceLabels: Record<OpenAISettingsStatus["source"], string> = {
  tenant: "管理画面",
  environment: "環境変数",
  none: "未設定",
};

function formatUpdatedAt(value: string | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusLabel(status: OpenAISettingsStatus | null) {
  if (!status) {
    return "確認中";
  }

  return status.configured ? "設定済み" : "未設定";
}

function getStatusVariant(status: OpenAISettingsStatus | null) {
  if (!status) {
    return "default";
  }

  return status.configured ? "success" : "warning";
}

export default function OpenAISettingsPage() {
  const [status, setStatus] = useState<OpenAISettingsStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canClearTenantKey = status?.source === "tenant";
  const saveDisabled = isSaving || apiKey.trim().length === 0;

  const statusDescription = useMemo(() => {
    if (!status) {
      return "OpenAI 設定を確認しています。";
    }

    if (status.source === "tenant") {
      return "このテナントの管理画面に保存されたキーを使用します。";
    }

    if (status.source === "environment") {
      return "OPENAI_API_KEY の値を使用します。";
    }

    return "AI 生成を使うには API キーが必要です。";
  }, [status]);

  async function loadStatus() {
    try {
      setIsLoading(true);
      const nextStatus = await getOpenAISettings();

      setStatus(nextStatus);
      setError(null);
    } catch (nextError) {
      setStatus(null);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "OpenAI 設定の読み込みに失敗しました。"
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSaving(true);
      const nextStatus = await saveOpenAISettings(apiKey);

      setStatus(nextStatus);
      setApiKey("");
      setShowApiKey(false);
      setNotice("OpenAI API キーを保存しました。");
      setError(null);
    } catch (nextError) {
      setNotice(null);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "OpenAI API キーの保存に失敗しました。"
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClear() {
    try {
      setIsClearing(true);
      const nextStatus = await clearOpenAISettings();

      setStatus(nextStatus);
      setNotice("管理画面の OpenAI API キーを削除しました。");
      setError(null);
    } catch (nextError) {
      setNotice(null);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "OpenAI API キーの削除に失敗しました。"
      );
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "ダッシュボード" },
          { label: "管理" },
          { label: "OpenAI 設定" },
        ]}
        actions={
          <Button
            variant="ghost"
            size="md"
            onClick={() => void loadStatus()}
            disabled={isLoading}
          >
            <Icon name="refresh" size="sm" />
            更新
          </Button>
        }
      />

      <main className="mx-auto max-w-[1200px] px-4 py-10 pt-24 md:px-10">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              状態
            </div>
            <Badge variant={getStatusVariant(status)}>
              {getStatusLabel(status)}
            </Badge>
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              利用元
            </div>
            <div className="font-headline text-lg font-bold tracking-tight text-on-surface">
              {status ? sourceLabels[status.source] : "-"}
            </div>
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              最終更新
            </div>
            <div className="font-headline text-lg font-bold tracking-tight text-on-surface">
              {formatUpdatedAt(status?.updatedAt)}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-error-container bg-error-container/40 p-3 text-sm font-medium text-on-error-container">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-4 rounded-lg border border-primary-container bg-primary-container/60 p-3 text-sm font-medium text-on-primary-container">
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-xl border border-outline-variant bg-surface p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-primary">
                    <Icon name="key" />
                  </span>
                  <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
                    OpenAI API キー
                  </h1>
                </div>
                <p className="max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                  {statusDescription}
                </p>
              </div>
              {status?.maskedApiKey && (
                <div className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                    現在のキー
                  </div>
                  <div className="mt-1 font-mono text-sm font-semibold text-on-surface">
                    {status.maskedApiKey}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={(event) => void handleSave(event)} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-on-surface">
                  新しいキー
                </span>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="sk-..."
                    className="w-full rounded-md border border-outline bg-surface py-2 pl-3 pr-12 font-mono text-sm text-on-surface placeholder:text-on-surface-muted hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((current) => !current)}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                    aria-label={showApiKey ? "キーを隠す" : "キーを表示"}
                  >
                    <Icon
                      name={showApiKey ? "visibility_off" : "visibility"}
                      size="sm"
                    />
                  </button>
                </div>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" variant="primary" size="md" disabled={saveDisabled}>
                  <Icon name="save" size="sm" />
                  {isSaving ? "保存中..." : "保存"}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  onClick={() => void handleClear()}
                  disabled={!canClearTenantKey || isClearing}
                >
                  <Icon name="delete" size="sm" />
                  {isClearing ? "削除中..." : "管理画面のキーを削除"}
                </Button>
              </div>
            </form>
          </section>

          <aside className="space-y-4">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-tertiary-container text-tertiary">
                <Icon name="admin_panel_settings" size="sm" />
              </span>
              <h2 className="font-headline text-lg font-bold tracking-tight text-on-surface">
                適用順
              </h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-outline-variant bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="mb-1 font-semibold text-on-surface">
                  1. 管理画面
                </div>
                <div className="text-[13px] leading-relaxed text-on-surface-variant">
                  テナントに保存されたキーを優先します。
                </div>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="mb-1 font-semibold text-on-surface">
                  2. 環境変数
                </div>
                <div className="text-[13px] leading-relaxed text-on-surface-variant">
                  未保存の場合は OPENAI_API_KEY を使います。
                </div>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="mb-1 font-semibold text-on-surface">
                  保存形式
                </div>
                <div className="text-[13px] leading-relaxed text-on-surface-variant">
                  キー本文は暗号化して保存し、画面には末尾 4 桁だけ表示します。
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { Input } from "@/components/shared/Input";
import { Button } from "@/components/shared/Button";
import { useClientReady } from "@/components/shared/useClientReady";
import { apiFetch } from "@/lib/api/client";
import type { App } from "@/types/app";

export default function ManualAppPage() {
  const router = useRouter();
  const ready = useClientReady();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const app = await apiFetch<App>("/api/apps", { method: "POST", body: JSON.stringify({ name: name.trim(), code: code.trim(), description, status: "draft" }) });
      router.push(`/apps/${app.id}/tables`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "アプリを作成できませんでした。");
      setSaving(false);
    }
  }

  return (
    <>
      <TopBar title="空のアプリ" breadcrumbs={[{ label: "ホーム", href: "/home" }, { label: "空のアプリ" }]} />
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-24">
        <h1 className="text-[22px] font-bold">空のアプリを作成</h1>
        <p className="mb-5 mt-2 text-sm text-on-surface-variant">AIを使わず下書きを作成します。テーブルと項目は作成後に追加できます。</p>
        <form onSubmit={(event) => void create(event)} className="space-y-4 rounded-lg border border-outline-variant bg-surface p-5">
          <label className="block text-sm font-semibold">アプリ名<Input className="mt-2" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required disabled={!ready || saving} /></label>
          <label className="block text-sm font-semibold">アプリコード<Input className="mt-2 font-mono" value={code} onChange={(event) => setCode(event.target.value)} pattern="[a-z][a-z0-9-]*" maxLength={64} required disabled={!ready || saving} /><span className="mt-1 block text-xs font-normal text-on-surface-variant">英小文字で始め、英小文字・数字・ハイフンを使います。</span></label>
          <label className="block text-sm font-semibold">説明（任意）<textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={!ready || saving} maxLength={1000} rows={3} className="mt-2 w-full rounded-md border border-outline bg-surface p-3 font-normal" /></label>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          <div className="flex items-center justify-end gap-3"><span className="text-xs text-on-surface-variant">{!name.trim() || !code.trim() ? "アプリ名とコードを入力してください" : "下書きとして保存します"}</span><Button type="submit" disabled={!ready || saving || !name.trim() || !code.trim()}>{saving ? "作成中..." : "下書きとして作成"}</Button></div>
        </form>
      </main>
    </>
  );
}

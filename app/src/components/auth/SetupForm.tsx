"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { apiFetch } from "@/lib/api/client";

export function SetupForm() {
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("passwordConfirmation")) {
      setError("確認用パスワードが一致しません。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/setup", {
        method: "POST",
        body: JSON.stringify({
          setupToken: form.get("setupToken"),
          organizationName: form.get("organizationName"),
          organizationCode: form.get("organizationCode"),
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      setCompleted(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "初期設定に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  if (completed) {
    return (
      <div className="space-y-5" role="status">
        <h2 className="text-xl font-bold">組織を作成しました</h2>
        <p className="text-sm text-on-surface-variant">登録した管理者のメールアドレスとパスワードでログインできます。</p>
        <Link href="/login" className="inline-flex rounded-lg bg-primary px-5 py-3 font-semibold text-white">ログインへ進む</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
        <div>
          <label htmlFor="setup-token" className="mb-1 block text-sm font-semibold">初期設定トークン</label>
          <Input id="setup-token" name="setupToken" type="password" autoComplete="off" required minLength={32} maxLength={1024} />
          <p className="mt-1 text-xs text-on-surface-variant">設置担当者から受け取ったトークンを入力してください。</p>
        </div>
        <div>
          <label htmlFor="setup-organization" className="mb-1 block text-sm font-semibold">組織名</label>
          <Input id="setup-organization" name="organizationName" autoComplete="organization" required maxLength={100} placeholder="株式会社サンプル" />
        </div>
        <div>
          <label htmlFor="setup-code" className="mb-1 block text-sm font-semibold">組織コード</label>
          <Input id="setup-code" name="organizationCode" required minLength={3} maxLength={64} pattern="[a-z0-9][a-z0-9\-]{1,62}[a-z0-9]" placeholder="my-company" />
          <p className="mt-1 text-xs text-on-surface-variant">3〜64文字の半角小文字・数字・ハイフン。ログイン時に組織を指定するために使います。</p>
        </div>
        <div>
          <label htmlFor="setup-name" className="mb-1 block text-sm font-semibold">管理者の表示名</label>
          <Input id="setup-name" name="name" autoComplete="name" required maxLength={100} />
        </div>
        <div>
          <label htmlFor="setup-email" className="mb-1 block text-sm font-semibold">管理者のメールアドレス</label>
          <Input id="setup-email" name="email" type="email" autoComplete="username" required maxLength={254} />
        </div>
        <div>
          <label htmlFor="setup-password" className="mb-1 block text-sm font-semibold">パスワード（12文字以上）</label>
          <Input id="setup-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} />
        </div>
        <div>
          <label htmlFor="setup-confirm" className="mb-1 block text-sm font-semibold">パスワードの確認</label>
          <Input id="setup-confirm" name="passwordConfirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={256} />
        </div>
      </fieldset>
      {error && <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
      <Button type="submit" disabled={saving} className="w-full justify-center">{saving ? "組織を作成中…" : "組織と管理者を作成"}</Button>
    </form>
  );
}

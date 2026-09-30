"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { apiFetch } from "@/lib/api/client";

export function PasswordChangeForm() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("newPassword") !== form.get("confirmation")) {
      setError("確認用パスワードが一致しません。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/settings/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }),
      });
      window.location.assign("/login");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "パスワードを変更できませんでした。");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-outline-variant bg-surface p-5">
      <h2 className="font-bold">パスワードを変更</h2>
      <p className="text-sm text-on-surface-variant">変更後はすべての端末からログアウトします。新しいパスワードでログインし直してください。</p>
      <fieldset disabled={saving} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block">現在のパスワード</span>
          <Input name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">新しいパスワード（12文字以上）</span>
          <Input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={256} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">新しいパスワードの確認</span>
          <Input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={256} />
        </label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <Button type="submit" disabled={saving}>{saving ? "変更中…" : "パスワードを変更してログアウト"}</Button>
    </form>
  );
}

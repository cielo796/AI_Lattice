"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { createAdminUser, type AdminUserSummary } from "@/lib/api/admin-users";
import { listRoles } from "@/lib/api/rbac";
import type { Role } from "@/types/user";

export function UserCreateForm({ onCreated, onCancel }: { onCreated: (user: AdminUserSummary) => void; onCancel: () => void }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleId, setRoleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listRoles().then((items) => {
      if (!active) return;
      setRoles(items);
      setRoleId(items.find((role) => role.roleType === "viewer")?.id ?? "");
    }).catch((nextError) => {
      if (active) setError(nextError instanceof Error ? nextError.message : "ロールを読み込めませんでした。");
    });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    try {
      const user = await createAdminUser({
        name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""), roleId,
      });
      onCreated(user);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "ユーザーを追加できませんでした。");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-outline-variant bg-surface p-5">
      <h2 className="font-bold">ユーザーを追加</h2>
      <p className="text-sm text-on-surface-variant">初期パスワードを本人へ安全に伝え、ログイン後にプロフィール画面で変更してもらってください。</p>
      <fieldset disabled={saving} className="grid gap-4 md:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block">表示名</span><Input name="name" required maxLength={100} autoComplete="off" /></label>
        <label className="text-sm"><span className="mb-1 block">メールアドレス</span><Input name="email" type="email" required maxLength={254} autoComplete="off" /></label>
        <label className="text-sm"><span className="mb-1 block">初期パスワード（12文字以上）</span><Input name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password" /></label>
        <label className="text-sm">
          <span className="mb-1 block">ロール（組織全体に適用）</span>
          <select value={roleId} onChange={(event) => setRoleId(event.target.value)} required className="w-full rounded-md border border-outline bg-surface px-3 py-2">
            <option value="">ロールを選択</option>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
        </label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>キャンセル</Button>
        <Button type="submit" disabled={saving || !roleId}>{saving ? "追加中…" : "ユーザーを作成"}</Button>
      </div>
    </form>
  );
}

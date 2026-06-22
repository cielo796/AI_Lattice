"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/shared/Avatar";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { Input } from "@/components/shared/Input";
import { TopBar } from "@/components/shared/TopBar";
import { getProfile, updateProfile } from "@/lib/api/profile";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";

export default function ProfileSettingsPage() {
  const setUser = useAuthStore((store) => store.setUser);
  const pushToast = useToastStore((store) => store.pushToast);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getProfile()
      .then((profile) => {
        if (!active) return;
        setName(profile.name);
        setEmail(profile.email);
        setAvatarUrl(profile.avatarUrl ?? "");
        setError(null);
      })
      .catch((nextError) => {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : "プロフィールを読み込めませんでした。");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsSaving(true);
      const profile = await updateProfile({ name, avatarUrl });
      setUser(profile);
      pushToast({ title: "プロフィールを保存しました。", variant: "success" });
    } catch (nextError) {
      pushToast({
        title: "プロフィールを保存できませんでした。",
        description: nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <TopBar title="プロフィール" breadcrumbs={[{ label: "設定" }, { label: "プロフィール" }]} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-24 md:px-8">
        <div className="mb-5">
          <h1 className="font-headline text-xl font-extrabold text-on-surface">プロフィール</h1>
          <p className="mt-1 text-sm text-on-surface-variant">表示名とプロフィール画像を管理します。</p>
        </div>

        {error && <div className="mb-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}

        <form onSubmit={(event) => void handleSubmit(event)} className="rounded-lg border border-outline-variant bg-surface p-5">
          <div className="mb-6 flex items-center gap-4">
            <Avatar name={name || email} size="lg" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-on-surface">{name || "-"}</div>
              <div className="truncate text-xs text-on-surface-variant">{email || "-"}</div>
            </div>
          </div>

          <div className="grid gap-4">
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-on-surface">表示名</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} disabled={isLoading} />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-on-surface">メールアドレス</span>
              <Input value={email} disabled />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-on-surface">画像URL</span>
              <Input type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://example.com/avatar.png" disabled={isLoading} />
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={isLoading || isSaving || !name.trim()}>
              <Icon name="save" size="sm" />
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </main>
    </>
  );
}

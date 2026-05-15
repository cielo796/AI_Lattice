"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/shared/Icon";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { useAuthStore } from "@/stores/authStore";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const [email, setEmail] = useState("marcus.chen@acme.com");
  const [password, setPassword] = useState("demo");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);

    if (success) {
      router.push("/home");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-container-low">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-[420px] bg-gradient-to-b from-primary-container/60 via-tertiary-container/30 to-transparent"
      />
      <div className="relative flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_4px_8px_rgba(240,106,106,0.25)]">
              <Icon name="hub" className="text-white" size="lg" />
            </div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
              AI Lattice
            </h1>
            <p className="mt-1.5 text-[13.5px] text-on-surface-variant">
              AI 駆動型 エンタープライズ・ローコード基盤
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-2xl border border-outline-variant bg-surface p-7 shadow-[0_4px_8px_rgba(15,23,42,0.04),0_24px_64px_rgba(15,23,42,0.08)]"
          >
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-on-surface">
                メールアドレス
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  clearError();
                  setEmail(e.target.value);
                }}
                icon="mail"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-[12px] font-semibold text-on-surface">
                  パスワード
                </label>
                <a
                  href="#"
                  className="text-[12px] font-medium text-primary hover:text-primary-hover"
                >
                  お忘れですか？
                </a>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  clearError();
                  setPassword(e.target.value);
                }}
                icon="lock"
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-3 w-full justify-center"
              disabled={isLoading}
            >
              サインイン
              <Icon name="arrow_forward" size="sm" />
            </Button>

            {error && (
              <div className="rounded-lg border border-error-container bg-error-container/40 px-4 py-3 text-sm font-medium text-on-error-container">
                {error}
              </div>
            )}

            <div className="border-t border-outline-variant pt-4 text-center text-[12px] text-on-surface-muted">
              デモモード ・ 任意の認証情報でログインできます
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

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
    <div className="min-h-screen flex items-center justify-center bg-surface px-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mb-4">
            <Icon name="apps" className="text-white" size="lg" />
          </div>
          <h1 className="font-headline text-3xl font-extrabold text-white tracking-tight">
            AI Lattice
          </h1>
          <p className="text-on-surface-variant text-sm mt-2">
            AI駆動型 エンタープライズ・ローコード基盤
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface-container rounded-xl p-8 shadow-[0_12px_40px_rgba(11,28,48,0.3)] space-y-5"
        >
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wider">
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
            <label className="block text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wider">
              パスワード
            </label>
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
            className="w-full justify-center mt-6"
            disabled={isLoading}
          >
            サインイン
            <Icon name="arrow_forward" size="sm" />
          </Button>

          {error && (
            <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <div className="pt-4 text-center text-xs text-on-surface-variant">
            デモモード ・ 任意の認証情報でログインできます
          </div>
        </form>
      </div>
    </div>
  );
}

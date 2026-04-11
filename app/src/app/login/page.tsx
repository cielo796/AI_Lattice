"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/shared/Icon";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { useAuthStore } from "@/stores/authStore";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("marcus.chen@acme.com");
  const [password, setPassword] = useState("demo");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      router.push("/home");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mb-4">
            <Icon name="apps" className="text-white" size="lg" />
          </div>
          <h1 className="font-headline text-3xl font-extrabold text-white tracking-tight">
            Intelligent Layer
          </h1>
          <p className="text-on-surface-variant text-sm mt-2">
            AI-driven enterprise low-code platform
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-surface-container rounded-xl p-8 shadow-[0_12px_40px_rgba(11,28,48,0.3)] space-y-5"
        >
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wider">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon="mail"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wider">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon="lock"
              placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full justify-center mt-6"
          >
            Sign in
            <Icon name="arrow_forward" size="sm" />
          </Button>

          <div className="pt-4 text-center text-xs text-on-surface-variant">
            Demo mode \u00b7 Any credentials will work
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { Input } from "@/components/shared/Input";
import { TopBar } from "@/components/shared/TopBar";
import { getTenantSettings, updateTenantSettings } from "@/lib/api/tenant";
import type { Tenant } from "@/types/user";
import { useToastStore } from "@/stores/toastStore";

function formatDate(value: string | undefined) {
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

export default function AdminTenantPage() {
  const pushToast = useToastStore((store) => store.pushToast);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Tenant["status"]>("active");
  const [planType, setPlanType] = useState("enterprise");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTenant() {
    try {
      setIsLoading(true);
      const nextTenant = await getTenantSettings();

      setTenant(nextTenant);
      setName(nextTenant.name);
      setCode(nextTenant.code);
      setStatus(nextTenant.status);
      setPlanType(nextTenant.planType);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "テナント設定の読み込みに失敗しました。"
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTenant();
  }, []);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSaving(true);
      const updated = await updateTenantSettings({
        name,
        code,
        status,
        planType,
      });

      setTenant(updated);
      pushToast({ title: "テナント設定を保存しました", variant: "success" });
    } catch (nextError) {
      pushToast({
        title: "保存に失敗しました",
        description: nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <TopBar breadcrumbs={[{ label: "管理" }, { label: "テナント設定" }]} />

      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-16 pt-24 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
              テナント設定
            </h1>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              組織名、コード、利用状態を管理します。
            </p>
          </div>
          <Button variant="ghost" onClick={() => void loadTenant()} disabled={isLoading}>
            <Icon name="refresh" size="sm" />
            更新
          </Button>
        </div>

        {error && (
          <div className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-outline-variant bg-surface p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-on-surface-muted">
              状態
            </div>
            <div className="mt-2">
              <Badge variant={tenant?.status === "active" ? "success" : "warning"}>
                {tenant?.status === "active" ? "active" : "inactive"}
              </Badge>
            </div>
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-on-surface-muted">
              作成日時
            </div>
            <div className="mt-2 text-sm font-semibold text-on-surface">
              {formatDate(tenant?.createdAt)}
            </div>
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-on-surface-muted">
              最終更新
            </div>
            <div className="mt-2 text-sm font-semibold text-on-surface">
              {formatDate(tenant?.updatedAt)}
            </div>
          </div>
        </div>

        <form
          onSubmit={(event) => void handleSave(event)}
          className="rounded-xl border border-outline-variant bg-surface p-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-on-surface">
                テナント名
              </span>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-on-surface">
                テナントコード
              </span>
              <Input value={code} onChange={(event) => setCode(event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-on-surface">
                プラン
              </span>
              <Input
                value={planType}
                onChange={(event) => setPlanType(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-on-surface">
                ステータス
              </span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as Tenant["status"])}
                className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <Button type="submit" disabled={isSaving || !name.trim() || !code.trim()}>
              <Icon name="save" size="sm" />
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </main>
    </>
  );
}


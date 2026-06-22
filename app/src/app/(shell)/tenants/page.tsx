"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Icon } from "@/components/shared/Icon";
import { TopBar } from "@/components/shared/TopBar";
import { listAvailableTenants } from "@/lib/api/tenant";
import type { Tenant } from "@/types/user";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void listAvailableTenants()
      .then((items) => {
        if (active) {
          setTenants(items);
          setError(null);
        }
      })
      .catch((nextError) => {
        if (active) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "テナントの読み込みに失敗しました。"
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <TopBar title="テナント" breadcrumbs={[{ label: "テナント選択" }]} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-24 md:px-8">
        <div className="mb-5">
          <h1 className="font-headline text-xl font-extrabold text-on-surface">
            テナント
          </h1>
          <p className="mt-1 text-xs text-on-surface-variant">
            現在利用する組織を確認します。
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        <div className="divide-y divide-outline-variant overflow-hidden rounded-lg border border-outline-variant bg-surface">
          {isLoading ? (
            <div className="px-5 py-10 text-center text-sm text-on-surface-variant">
              読み込み中...
            </div>
          ) : (
            tenants.map((tenant) => (
              <div key={tenant.id} className="flex items-center gap-4 px-5 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container text-primary">
                  <Icon name="domain" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-on-surface">{tenant.name}</div>
                  <div className="text-xs text-on-surface-variant">{tenant.code}</div>
                </div>
                <Badge variant={tenant.status === "active" ? "success" : "warning"}>
                  {tenant.status === "active" ? "選択中" : "停止中"}
                </Badge>
                <Link
                  href="/home"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-[13px] font-semibold text-white hover:bg-primary-hover"
                >
                  開く
                  <Icon name="arrow_forward" size="sm" />
                </Link>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}


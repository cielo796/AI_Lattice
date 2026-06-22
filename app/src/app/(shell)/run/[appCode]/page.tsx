"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Icon } from "@/components/shared/Icon";
import { TopBar } from "@/components/shared/TopBar";
import { getRuntimeAppOverview } from "@/lib/api/apps";
import type { RuntimeAppOverview } from "@/types/app";

export default function RuntimeAppPage({
  params,
}: {
  params: Promise<{ appCode: string }>;
}) {
  const { appCode } = use(params);
  const [overview, setOverview] = useState<RuntimeAppOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getRuntimeAppOverview(appCode)
      .then((value) => {
        if (active) {
          setOverview(value);
          setError(null);
        }
      })
      .catch((nextError) => {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : "読み込みに失敗しました。");
        }
      });
    return () => {
      active = false;
    };
  }, [appCode]);

  return (
    <>
      <TopBar
        title={overview?.app.name ?? "アプリ"}
        breadcrumbs={[{ label: "Runtime" }, { label: overview?.app.name ?? appCode }]}
      />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-16 pt-24 md:px-8">
        {error && <div className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container text-primary">
                <Icon name={overview?.app.icon ?? "apps"} />
              </span>
              <div>
                <h1 className="font-headline text-2xl font-extrabold text-on-surface">
                  {overview?.app.name ?? "読み込み中..."}
                </h1>
                <p className="text-xs text-on-surface-variant">{overview?.app.description}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/run/${appCode}/dashboard`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-outline bg-surface px-3.5 text-[13px] font-semibold text-on-surface hover:bg-surface-container">
              <Icon name="dashboard" size="sm" />ダッシュボード
            </Link>
            <Link href={`/run/${appCode}/approvals`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-outline bg-surface px-3.5 text-[13px] font-semibold text-on-surface hover:bg-surface-container">
              <Icon name="approval" size="sm" />承認
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["テーブル", overview?.tables.length ?? 0, "table_chart"],
            ["レコード", overview?.totals.records ?? 0, "database"],
            ["承認待ち", overview?.totals.pendingApprovals ?? 0, "pending_actions"],
            ["公開状態", overview?.app.status ?? "-", "published_with_changes"],
          ].map(([label, value, icon]) => (
            <div key={String(label)} className="rounded-lg border border-outline-variant bg-surface p-4">
              <div className="flex items-center justify-between text-[11px] font-semibold text-on-surface-variant">
                {label}<Icon name={String(icon)} size="sm" />
              </div>
              <div className="mt-2 font-headline text-2xl font-bold text-on-surface">{value}</div>
            </div>
          ))}
        </div>

        <section>
          <h2 className="mb-3 font-headline text-base font-bold text-on-surface">テーブル</h2>
          <div className="divide-y divide-outline-variant overflow-hidden rounded-lg border border-outline-variant bg-surface">
            {overview?.tables.map((table) => (
              <Link key={table.id} href={`/run/${appCode}/${table.code}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-container-low">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-container-high text-primary">
                  <Icon name="table_rows" size="sm" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-on-surface">{table.name}</div>
                  <div className="text-[11px] text-on-surface-variant">{table.fieldCount} fields / {table.viewCount} views / {table.formCount} forms</div>
                </div>
                <Badge variant="info">{table.recordCount} records</Badge>
                <Icon name="chevron_right" size="sm" className="text-on-surface-muted" />
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}


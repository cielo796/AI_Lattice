"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { getRuntimeAppOverview } from "@/lib/api/apps";
import { getRuntimeTableMeta, listRecords } from "@/lib/api/records";
import { getChartBuckets, getMetricFieldCode, getNumericMetricValues, formatNumber } from "@/lib/runtime-views";
import type { AppField, AppView, RuntimeAppOverview } from "@/types/app";
import type { AppRecord } from "@/types/record";

type TableDashboard = {
  id: string;
  code: string;
  name: string;
  records: AppRecord[];
  fields: AppField[];
  kpiView?: AppView;
  chartView?: AppView;
};

export default function RuntimeDashboardPage({ params }: { params: Promise<{ appCode: string }> }) {
  const { appCode } = use(params);
  const [overview, setOverview] = useState<RuntimeAppOverview | null>(null);
  const [tables, setTables] = useState<TableDashboard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getRuntimeAppOverview(appCode)
      .then(async (nextOverview) => {
        const dashboards = await Promise.all(
          nextOverview.tables.map(async (table) => {
            const [meta, records] = await Promise.all([
              getRuntimeTableMeta(appCode, table.code),
              listRecords(appCode, table.code),
            ]);
            return {
              id: table.id,
              code: table.code,
              name: table.name,
              records,
              fields: meta.fields,
              kpiView: meta.views.find((view) => view.viewType === "kpi"),
              chartView: meta.views.find((view) => view.viewType === "chart"),
            };
          })
        );
        if (active) {
          setOverview(nextOverview);
          setTables(dashboards);
          setError(null);
        }
      })
      .catch((nextError) => {
        if (active) setError(nextError instanceof Error ? nextError.message : "ダッシュボードの読み込みに失敗しました。");
      });
    return () => {
      active = false;
    };
  }, [appCode]);

  return (
    <>
      <TopBar title="ダッシュボード" breadcrumbs={[{ label: overview?.app.name ?? appCode }, { label: "ダッシュボード" }]} />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-16 pt-24 md:px-8">
        {error && <div className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-outline-variant bg-surface p-4"><div className="text-xs text-on-surface-variant">総レコード</div><div className="mt-1 text-3xl font-bold text-on-surface">{overview?.totals.records ?? 0}</div></div>
          <div className="rounded-lg border border-outline-variant bg-surface p-4"><div className="text-xs text-on-surface-variant">承認待ち</div><div className="mt-1 text-3xl font-bold text-on-surface">{overview?.totals.pendingApprovals ?? 0}</div></div>
          <div className="rounded-lg border border-outline-variant bg-surface p-4"><div className="text-xs text-on-surface-variant">テーブル</div><div className="mt-1 text-3xl font-bold text-on-surface">{overview?.tables.length ?? 0}</div></div>
        </div>

        {tables.map((table) => {
          const metricCode = getMetricFieldCode(table.kpiView, table.fields);
          const metrics = getNumericMetricValues(table.records, metricCode);
          const metricValue = metrics.length > 0 ? metrics.reduce((sum, value) => sum + value, 0) : table.records.length;
          const buckets = getChartBuckets(table.records, table.fields, table.chartView);
          return (
            <section key={table.id} className="border-t border-outline-variant pt-5">
              <div className="mb-4 flex items-center justify-between">
                <div><h2 className="font-headline text-base font-bold text-on-surface">{table.name}</h2><p className="text-xs text-on-surface-variant">{table.records.length} records</p></div>
                <Link href={`/run/${appCode}/${table.code}`} className="text-xs font-semibold text-primary hover:underline">レコードを開く</Link>
              </div>
              <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="rounded-lg border border-outline-variant bg-surface p-4">
                  <div className="text-xs font-semibold text-on-surface-variant">{table.kpiView?.name ?? "レコード件数"}</div>
                  <div className="mt-3 font-headline text-3xl font-bold text-on-surface">{formatNumber(metricValue)}</div>
                  <div className="mt-2 text-[11px] text-on-surface-muted">{metricCode ? `SUM ${metricCode}` : "COUNT"}</div>
                </div>
                <div className="rounded-lg border border-outline-variant bg-surface p-4">
                  <div className="mb-4 text-xs font-semibold text-on-surface-variant">{table.chartView?.name ?? "ステータス分布"}</div>
                  <div className="space-y-3">
                    {buckets.length === 0 ? <div className="py-6 text-center text-xs text-on-surface-muted">集計データがありません。</div> : buckets.map((bucket) => (
                      <div key={bucket.key} className="grid grid-cols-[110px_1fr_60px] items-center gap-3 text-xs">
                        <span className="truncate text-on-surface-variant">{bucket.label}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-surface-container-high"><div className="h-full rounded-full bg-primary" style={{ width: `${bucket.percent}%` }} /></div>
                        <span className="text-right font-semibold text-on-surface">{formatNumber(bucket.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}

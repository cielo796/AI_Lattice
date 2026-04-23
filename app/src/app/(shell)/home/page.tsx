"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { Icon } from "@/components/shared/Icon";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import type { App } from "@/types/app";
import { listApps } from "@/lib/api/apps";
import { useAuthStore } from "@/stores/authStore";

const statusLabel: Record<App["status"], string> = {
  published: "公開中",
  draft: "下書き",
  archived: "アーカイブ",
};

function getAppHref(app: App) {
  return app.primaryTableCode
    ? `/run/${app.code}/${app.primaryTableCode}`
    : `/apps/${app.id}/tables`;
}

export default function HomePage() {
  const userName = useAuthStore((s) => s.user?.name ?? "Marcus");
  const [apps, setApps] = useState<App[]>([]);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [isLoadingApps, setIsLoadingApps] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadApps() {
      try {
        setIsLoadingApps(true);
        const nextApps = await listApps();

        if (active) {
          setApps(nextApps);
          setAppsError(null);
        }
      } catch (error) {
        if (active) {
          setApps([]);
          setAppsError(
            error instanceof Error ? error.message : "アプリの読み込みに失敗しました"
          );
        }
      } finally {
        if (active) {
          setIsLoadingApps(false);
        }
      }
    }

    void loadApps();

    return () => {
      active = false;
    };
  }, []);

  const statCards = [
    {
      label: "有効なアプリ",
      value: String(apps.length),
      icon: "apps",
      accent: "text-primary",
    },
    {
      label: "承認待ち",
      value: "12",
      icon: "pending_actions",
      accent: "text-amber-400",
    },
    {
      label: "本日の AI 実行",
      value: "284",
      icon: "auto_awesome",
      accent: "text-primary",
    },
    {
      label: "未対応チケット",
      value: "8",
      icon: "confirmation_number",
      accent: "text-blue-400",
    },
  ];

  return (
    <>
      <TopBar
        title="AI Lattice"
        breadcrumbs={[{ label: "ダッシュボード" }, { label: "ホーム" }]}
        actions={
          <Link href="/apps/new/ai">
            <Button variant="primary" size="md">
              <Icon name="auto_awesome" size="sm" filled />
              AI で作成
            </Button>
          </Link>
        }
      />

      <main className="pt-16 px-10 py-10">
        <div className="mb-10">
          <h2 className="font-headline text-4xl font-extrabold text-white mb-2 tracking-tight">
            おかえりなさい、{userName}
          </h2>
          <p className="text-on-surface-variant">
            AI で社内アプリを設計し、ワークフローを自動化し、日々の業務を
            ひとつのワークスペースで確認できます。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="bg-surface-container rounded-xl p-6 hover:bg-surface-container-high transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  {stat.label}
                </span>
                <Icon name={stat.icon} className={stat.accent} size="md" />
              </div>
              <div className="text-3xl font-headline font-extrabold text-white">
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-headline text-2xl font-bold text-white">
            マイアプリ
          </h3>
          <Link
            href="/apps/new/ai"
            className="text-primary text-sm font-bold flex items-center gap-1 hover:text-emerald-400"
          >
            <Icon name="add" size="sm" />
            新規作成
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {apps.map((app) => (
            <Link
              key={app.id}
              href={getAppHref(app)}
              className="bg-surface-container rounded-xl p-6 hover:bg-surface-container-high transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon name={app.icon} className="text-primary" size="lg" />
                </div>
                <Badge variant={app.status === "published" ? "success" : "warning"}>
                  {statusLabel[app.status]}
                </Badge>
              </div>
              <h4 className="font-headline font-bold text-white text-lg mb-1 group-hover:text-primary transition-colors">
                {app.name}
              </h4>
              <p className="text-xs text-on-surface-variant line-clamp-2">
                {app.description}
              </p>
              <div className="mt-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                {app.tableCount && app.tableCount > 0
                  ? `${app.tableCount} 件のテーブル`
                  : "テーブル未作成"}
              </div>
            </Link>
          ))}
        </div>

        {isLoadingApps && (
          <div className="mt-4 text-sm text-on-surface-variant">
            アプリを読み込んでいます...
          </div>
        )}

        {appsError && (
          <div className="mt-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {appsError}
          </div>
        )}

        <div className="mt-12">
          <h3 className="font-headline text-2xl font-bold text-white mb-6">
            AI からの提案
          </h3>
          <div className="bg-emerald-950/30 rounded-xl p-6 border border-primary/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center shrink-0">
                <Icon name="auto_awesome" className="text-primary" filled size="md" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-primary tracking-wider uppercase mb-1">
                  おすすめ
                </div>
                <p className="text-on-surface text-sm">
                  未解決の重要チケットに絞ったビューを追加すると、サポートチームが
                  緊急インシデントをより早く切り分けられます。
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary">
                    確認する
                  </Button>
                  <Button size="sm" variant="ghost">
                    後で
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { TopBar } from "@/components/shared/TopBar";
import { deleteApp, listApps } from "@/lib/api/apps";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import type { App } from "@/types/app";

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
  const userName = useAuthStore((store) => store.user?.name ?? "Marcus");
  const pushToast = useToastStore((store) => store.pushToast);
  const [apps, setApps] = useState<App[]>([]);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [deletingAppId, setDeletingAppId] = useState<string | null>(null);

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

  async function handleDeleteApp(app: App) {
    const confirmed = window.confirm(
      `「${app.name}」を削除しますか？このアプリに紐づくテーブル、フィールド、レコードも削除されます。`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingAppId(app.id);
      await deleteApp(app.id);
      setApps((current) => current.filter((currentApp) => currentApp.id !== app.id));
      setAppsError(null);
      pushToast({
        title: "アプリを削除しました",
        description: app.name,
        variant: "success",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "アプリの削除に失敗しました";
      setAppsError(errorMessage);
      pushToast({
        title: "アプリの削除に失敗しました",
        description: errorMessage,
        variant: "error",
      });
    } finally {
      setDeletingAppId(null);
    }
  }

  const statCards = [
    {
      label: "公開中のアプリ",
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

      <main className="px-10 py-10 pt-16">
        <div className="mb-10">
          <h2 className="mb-2 font-headline text-4xl font-extrabold tracking-tight text-white">
            おかえりなさい、{userName}
          </h2>
          <p className="text-on-surface-variant">
            AI で業務アプリを設計し、ワークフローを整理しながら日々の運用を
            ひとつのワークスペースで確認できます。
          </p>
        </div>

        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-surface-container p-6 transition-colors hover:bg-surface-container-high"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
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
            className="flex items-center gap-1 text-sm font-bold text-primary hover:text-emerald-400"
          >
            <Icon name="add" size="sm" />
            新規作成
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {apps.map((app) => (
            <div
              key={app.id}
              className="rounded-xl bg-surface-container p-6 transition-colors hover:bg-surface-container-high"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <Link
                  href={getAppHref(app)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors hover:bg-primary/20"
                >
                  <Icon name={app.icon} className="text-primary" size="lg" />
                </Link>
                <Badge variant={app.status === "published" ? "success" : "warning"}>
                  {statusLabel[app.status]}
                </Badge>
              </div>

              <Link href={getAppHref(app)} className="block">
                <h4 className="mb-1 font-headline text-lg font-bold text-white transition-colors hover:text-primary">
                  {app.name}
                </h4>
                <p className="line-clamp-2 text-xs text-on-surface-variant">
                  {app.description || "説明はありません"}
                </p>
              </Link>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  {app.tableCount && app.tableCount > 0
                    ? `${app.tableCount} 個のテーブル`
                    : "テーブル未作成"}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={getAppHref(app)}
                    className="text-xs font-bold text-primary transition-colors hover:text-emerald-400"
                  >
                    開く
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={deletingAppId === app.id}
                    onClick={() => void handleDeleteApp(app)}
                  >
                    <Icon name="delete" size="sm" />
                    {deletingAppId === app.id ? "削除中..." : "削除"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {isLoadingApps && (
          <div className="mt-4 text-sm text-on-surface-variant">
            アプリを読み込んでいます...
          </div>
        )}

        {!isLoadingApps && apps.length === 0 && !appsError && (
          <div className="mt-4 rounded-lg border border-dashed border-outline-variant/40 px-4 py-6 text-sm text-on-surface-variant">
            まだアプリがありません。AI で作成または新規作成から追加できます。
          </div>
        )}

        {appsError && (
          <div className="mt-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {appsError}
          </div>
        )}

        <div className="mt-12">
          <h3 className="mb-6 font-headline text-2xl font-bold text-white">
            AI からの提案
          </h3>
          <div className="rounded-xl border border-primary/20 bg-emerald-950/30 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                <Icon name="auto_awesome" className="text-primary" filled size="md" />
              </div>
              <div className="flex-1">
                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">
                  おすすめ
                </div>
                <p className="text-sm text-on-surface">
                  未解決の高優先度チケットに沿ったビューを追加すると、サポートチームの
                  優先順位インシデントをより早く追いかけられます。
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

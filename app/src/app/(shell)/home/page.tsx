"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { AppActionMenu } from "@/components/shared/AppActionMenu";
import { Icon } from "@/components/shared/Icon";
import { TopBar } from "@/components/shared/TopBar";
import { cn } from "@/lib/cn";
import { listAIExecutionLogs } from "@/lib/api/ai-logs";
import { listApprovals } from "@/lib/api/approvals";
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
  const management = useSearchParams().get("manage");
  const appHref = (app: App) => management === "tables" || management === "workflows" ? `/apps/${app.id}/${management}` : getAppHref(app);
  const userName = useAuthStore((store) => store.user?.name);
  const pushToast = useToastStore((store) => store.pushToast);
  const [layout, setLayout] = useState<"table" | "cards">("table");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [apps, setApps] = useState<App[]>([]);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [deletingAppId, setDeletingAppId] = useState<string | null>(null);
  const [pendingApprovalCount, setPendingApprovalCount] = useState<number | null>(
    null
  );
  const [todayAICount, setTodayAICount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboardStats() {
      const [approvalsResult, aiLogsResult] = await Promise.allSettled([
        listApprovals({ status: "pending", limit: 200 }),
        listAIExecutionLogs({ limit: 200 }),
      ]);

      if (!active) {
        return;
      }

      if (approvalsResult.status === "fulfilled") {
        setPendingApprovalCount(approvalsResult.value.length);
      }

      if (aiLogsResult.status === "fulfilled") {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        setTodayAICount(
          aiLogsResult.value.filter(
            (log) => new Date(log.createdAt) >= todayStart
          ).length
        );
      }
    }

    void loadDashboardStats();

    return () => {
      active = false;
    };
  }, []);

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

  const publishedCount = apps.filter((app) => app.status === "published").length;
  const draftCount = apps.filter((app) => app.status === "draft").length;
  const visibleApps = apps.filter((app) => filter === "all" || app.status === filter);
  const stats = [
    { label: "公開中のアプリ", value: isLoadingApps ? "—" : publishedCount, icon: "apps", destination: "一覧を見る", filter: "published" as const },
    { label: "下書きのアプリ", value: isLoadingApps ? "—" : draftCount, icon: "edit", destination: "続きを編集", filter: "draft" as const },
    { label: "承認待ち", value: pendingApprovalCount ?? "—", icon: "check", destination: pendingApprovalCount === 0 ? "対応が必要な依頼はありません" : "承認依頼を見る", href: "/admin/approvals" },
    { label: "本日のAI実行", value: todayAICount ?? "—", icon: "auto_awesome", destination: "AI実行ログ", href: "/admin/ai-logs" },
  ];
  const today = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date());
  const appStatus = (app: App) => <Badge variant={app.status === "published" ? "success" : "default"}><Icon name={app.status === "published" ? "check" : "edit"} size="sm" />{statusLabel[app.status]}</Badge>;
  const tableCount = (app: App) => app.tableCount && app.tableCount > 0 ? <span>{app.tableCount}個</span> : <span className="inline-flex items-center gap-1 text-warning"><Icon name="warning" size="sm" />未作成</span>;
  const appIcon = (app: App) => <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-container text-on-surface-variant"><Icon name={app.icon || "apps"} size="sm" /></span>;
  const actions = (app: App) => <div className="flex items-center justify-end gap-2"><Link href={appHref(app)} className="rounded-md px-2 py-1 text-xs font-semibold text-info hover:bg-info-container" aria-label={`${app.name}を開く`}>開く</Link><AppActionMenu app={app} deleting={deletingAppId === app.id} onDelete={() => void handleDeleteApp(app)} /></div>;

  return (
    <>
      <TopBar title="ホーム" breadcrumbs={[{ label: "ダッシュボード" }, { label: "ホーム" }]} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 pb-10 pt-20 md:px-8" data-guide="home-main">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold leading-[30px]">ホーム</h1>
            <p className="mt-1 text-[13px] text-on-surface-variant">{userName ? `おかえりなさい、${userName} さん` : "おかえりなさい"} ・ {today}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/apps/new/manual" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-outline bg-surface px-3 text-xs font-semibold hover:bg-surface-container"><Icon name="add" size="sm" />空のアプリ</Link>
            <Link href="/apps/new/ai" data-guide="home-create-app" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-on-primary hover:brightness-95"><Icon name="auto_awesome" size="sm" />AIでアプリを作成</Link>
          </div>
        </div>

        <section className="grid grid-cols-2 overflow-hidden rounded-lg border border-outline-variant bg-surface md:grid-cols-4" data-guide="home-stats" aria-label="業務の状況">
          {stats.map((stat, index) => (
            <div key={stat.label} className={cn("border-outline-variant p-4", index > 0 && "md:border-l", index % 2 === 1 && "border-l", index > 1 && "border-t md:border-t-0")}>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant"><Icon name={stat.icon} size="sm" />{stat.label}</span>
              <div className="my-1 text-[28px] font-bold leading-9">{stat.value}</div>
              {stat.filter ? <a href="#my-apps" onClick={() => setFilter(stat.filter)} className="text-xs text-on-surface-variant hover:text-info">{stat.destination}</a> : <Link href={stat.href!} className="text-xs text-on-surface-variant hover:text-info">{stat.destination}</Link>}
            </div>
          ))}
        </section>

        <section id="my-apps" className="scroll-mt-20 space-y-3">
          {(management === "tables" || management === "workflows") && <p className="rounded-md bg-info-container p-3 text-xs text-on-info-container">{management === "tables" ? "テーブル" : "ワークフロー"}を編集するアプリを選び、「開く」を押してください。</p>}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-bold">マイアプリ</h2>
            <span className="text-xs text-on-surface-variant">{visibleApps.length}件</span>
            {filter !== "all" && <button onClick={() => setFilter("all")} className="text-xs text-info underline">すべて表示</button>}
            <div className="ml-auto flex rounded-md border border-outline-variant bg-surface-container p-0.5" role="group" aria-label="アプリ一覧の表示">
              {(["cards", "table"] as const).map((mode) => <button type="button" key={mode} aria-pressed={layout === mode} onClick={() => setLayout(mode)} className={cn("rounded px-3 py-1.5 text-xs font-semibold", layout === mode ? "bg-surface text-on-surface shadow-card" : "text-on-surface-variant")}>{mode === "table" ? "表" : "カード"}</button>)}
            </div>
          </div>
          {layout === "table" ? (
            <div className="relative overflow-x-auto rounded-lg border border-outline-variant bg-surface" data-guide="home-app-grid">
              <table className="w-full min-w-[560px] border-collapse text-[13px]">
                <caption className="sr-only">マイアプリ一覧</caption>
                <thead className="bg-surface-container text-left text-xs text-on-surface-variant"><tr><th scope="col" className="px-4 py-3 font-semibold">アプリ</th><th scope="col" className="w-28 px-3 py-3 font-semibold">状態</th><th scope="col" className="w-28 px-3 py-3 font-semibold">テーブル</th><th scope="col" className="w-28 px-3 py-3"><span className="sr-only">操作</span></th></tr></thead>
                <tbody>{visibleApps.map((app, index) => <tr key={app.id} data-testid={`app-card-${app.id}`} data-guide={index === 0 ? "home-app-card" : undefined} className="border-t border-outline-variant hover:bg-surface-container/40"><td className="px-4 py-3"><div className="flex items-center gap-3">{appIcon(app)}<div className="min-w-0"><Link href={getAppHref(app)} className="font-semibold hover:text-info">{app.name}</Link><p className="mt-0.5 max-w-md truncate text-xs text-on-surface-variant">{app.description || "説明はありません"}</p></div></div></td><td className="px-3 py-3">{appStatus(app)}</td><td className="px-3 py-3">{tableCount(app)}</td><td className="px-3 py-3">{actions(app)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-guide="home-app-grid">{visibleApps.map((app, index) => <article key={app.id} data-testid={`app-card-${app.id}`} data-guide={index === 0 ? "home-app-card" : undefined} className="rounded-lg border border-outline-variant bg-surface p-4"><div className="mb-3 flex items-center justify-between">{appIcon(app)}{appStatus(app)}</div><Link href={getAppHref(app)} className="text-sm font-semibold hover:text-info">{app.name}</Link><p className="mt-1 line-clamp-2 min-h-9 text-xs leading-relaxed text-on-surface-variant">{app.description || "説明はありません"}</p><div className="mt-3 flex items-center justify-between border-t border-outline-variant pt-3 text-xs">{tableCount(app)}{actions(app)}</div></article>)}</div>
          )}
          {isLoadingApps && <p role="status" className="text-sm text-on-surface-variant">アプリを読み込んでいます...</p>}
          {!isLoadingApps && visibleApps.length === 0 && !appsError && <div className="rounded-lg border border-dashed border-outline bg-surface p-8 text-center" data-guide="home-empty-state"><Icon name="apps" className="text-on-surface-variant" /><p className="mt-2 text-sm font-semibold">{apps.length ? "この状態のアプリはありません" : "まだアプリがありません"}</p><p className="mt-1 text-xs text-on-surface-variant">「AIでアプリを作成」または「空のアプリ」から追加できます。</p></div>}
          {appsError && <p role="alert" className="rounded-md bg-error-container p-3 text-sm text-error">{appsError}</p>}
        </section>

        <section className="space-y-3">
          <h2 className="text-[15px] font-bold">クイックアクション</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { href: "/apps/new/ai", icon: "auto_awesome", title: "AIでアプリを作成", description: "業務内容を文章で説明すると、テーブル・ビューの下書きを作ります。" },
              { href: "/admin/approvals", icon: "check", title: "承認を処理する", description: "ワークフローから届いた承認依頼を確認し、承認・差し戻しを行います。" },
              { href: "/admin/ai-logs", icon: "monitoring", title: "AI利用状況を確認", description: "AI実行の履歴・トークン使用量・エラーを監査ログとあわせて追跡します。" },
            ].map((action) => <Link key={action.href} href={action.href} className="flex items-start gap-3 rounded-lg border border-outline-variant bg-surface p-4 hover:border-primary"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-container text-on-surface-variant"><Icon name={action.icon} size="sm" /></span><div><h3 className="text-[13px] font-semibold">{action.title}</h3><p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{action.description}</p></div></Link>)}
          </div>
        </section>
      </main>
    </>
  );
}

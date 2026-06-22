"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
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
  const userName = useAuthStore((store) => store.user?.name);
  const pushToast = useToastStore((store) => store.pushToast);
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
  const statCards = [
    {
      label: "公開中のアプリ",
      value: isLoadingApps ? "—" : String(publishedCount),
      icon: "apps",
      accent: "text-[#f06a6a] bg-[#ffe4e0]",
      href: "/home",
    },
    {
      label: "下書きのアプリ",
      value: isLoadingApps ? "—" : String(draftCount),
      icon: "edit_note",
      accent: "text-[#1f3d7a] bg-[#dde7f9]",
      href: "/home",
    },
    {
      label: "承認待ち",
      value: pendingApprovalCount === null ? "—" : String(pendingApprovalCount),
      icon: "pending_actions",
      accent: "text-[#6e4a14] bg-[#fdecd1]",
      href: "/admin/approvals",
    },
    {
      label: "本日の AI 実行",
      value: todayAICount === null ? "—" : String(todayAICount),
      icon: "auto_awesome",
      accent: "text-[#3b257a] bg-[#ece5fc]",
      href: "/admin/ai-logs",
    },
  ];

  return (
    <>
      <TopBar
        title="ホーム"
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

      <main className="mx-auto max-w-7xl px-6 py-8 pt-20 md:px-10">
        <div className="mb-10">
          <h2 className="mb-2 font-headline text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
            {userName ? `おかえりなさい、${userName}` : "おかえりなさい"}
          </h2>
          <p className="text-[15px] text-on-surface-variant">
            AI で業務アプリを設計し、ワークフローを整理しながら日々の運用を
            ひとつのワークスペースで確認できます。
          </p>
        </div>

        <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="group rounded-xl border border-outline-variant bg-surface p-5 transition-shadow hover:shadow-[0_2px_4px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                  {stat.label}
                </span>
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
                    stat.accent
                  )}
                >
                  <Icon name={stat.icon} size="sm" />
                </span>
              </div>
              <div className="font-headline text-[28px] font-extrabold tracking-tight text-on-surface">
                {stat.value}
              </div>
            </Link>
          ))}
        </div>

        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-headline text-xl font-bold tracking-tight text-on-surface">
            マイアプリ
          </h3>
          <Link
            href="/apps/new/ai"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-semibold text-primary transition-colors hover:bg-primary-container hover:text-on-primary-container"
          >
            <Icon name="add" size="sm" />
            新規作成
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {apps.map((app, idx) => {
            const tints = [
              { bg: "bg-[#ffe4e0]", text: "text-[#f06a6a]" },
              { bg: "bg-[#ece5fc]", text: "text-[#8d6cdc]" },
              { bg: "bg-[#dde7f9]", text: "text-[#4573d2]" },
              { bg: "bg-[#d6f0e2]", text: "text-[#4cb782]" },
              { bg: "bg-[#fdecd1]", text: "text-[#f1bd6c]" },
              { bg: "bg-[#fce7f2]", text: "text-[#f9a7c2]" },
            ];
            const tint = tints[idx % tints.length];
            return (
              <div
                key={app.id}
                data-testid={`app-card-${app.id}`}
                className="group rounded-xl border border-outline-variant bg-surface p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(15,23,42,0.06),0_16px_40px_rgba(15,23,42,0.08)]"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <Link
                    href={getAppHref(app)}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                      tint.bg
                    )}
                  >
                    <Icon name={app.icon} className={tint.text} size="lg" />
                  </Link>
                  <Badge variant={app.status === "published" ? "success" : "warning"}>
                    {statusLabel[app.status]}
                  </Badge>
                </div>

                <Link href={getAppHref(app)} className="block">
                  <h4 className="mb-1 font-headline text-[15px] font-bold tracking-tight text-on-surface transition-colors group-hover:text-primary">
                    {app.name}
                  </h4>
                  <p className="line-clamp-2 text-[12.5px] leading-relaxed text-on-surface-variant">
                    {app.description || "説明はありません"}
                  </p>
                </Link>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-outline-variant pt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                    {app.tableCount && app.tableCount > 0
                      ? `${app.tableCount} 個のテーブル`
                      : "テーブル未作成"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={getAppHref(app)}
                      className="rounded-md px-2 py-1 text-[12px] font-semibold text-primary transition-colors hover:bg-primary-container"
                    >
                      開く
                    </Link>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      data-testid={`delete-app-${app.id}`}
                      disabled={deletingAppId === app.id}
                      onClick={() => void handleDeleteApp(app)}
                      className="!text-error hover:!bg-error-container"
                    >
                      <Icon name="delete" size="sm" />
                      {deletingAppId === app.id ? "削除中..." : "削除"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {isLoadingApps && (
          <div className="mt-4 text-sm text-on-surface-variant">
            アプリを読み込んでいます...
          </div>
        )}

        {!isLoadingApps && apps.length === 0 && !appsError && (
          <div className="mt-4 rounded-xl border-2 border-dashed border-outline-variant bg-surface px-6 py-10 text-center">
            <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-container text-primary">
              <Icon name="apps" size="lg" />
            </div>
            <p className="text-sm font-medium text-on-surface">
              まだアプリがありません
            </p>
            <p className="mt-1 text-[13px] text-on-surface-variant">
              「AI で作成」または「新規作成」から追加できます。
            </p>
          </div>
        )}

        {appsError && (
          <div className="mt-4 rounded-lg border border-error-container bg-error-container/40 px-4 py-3 text-sm font-medium text-on-error-container">
            {appsError}
          </div>
        )}

        <div className="mt-12">
          <h3 className="mb-5 font-headline text-xl font-bold tracking-tight text-on-surface">
            クイックアクション
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                href: "/apps/new/ai",
                icon: "auto_awesome",
                title: "AI でアプリを作成",
                description:
                  "業務内容を文章で説明すると、テーブル・ビュー・ワークフローの下書きを自動生成します。",
                accent: "bg-tertiary text-white",
                border: "border-tertiary-container bg-tertiary-container/40",
              },
              {
                href: "/admin/approvals",
                icon: "approval",
                title: "承認を処理する",
                description:
                  "ワークフローから届いた承認依頼を確認し、承認・差戻しを行います。",
                accent: "bg-[#f1bd6c] text-[#6e4a14]",
                border: "border-outline-variant bg-surface",
              },
              {
                href: "/admin/ai-logs",
                icon: "monitoring",
                title: "AI 利用状況を確認",
                description:
                  "AI 実行の履歴・トークン使用量・エラーを監査ログとあわせて追跡します。",
                accent: "bg-[#4573d2] text-white",
                border: "border-outline-variant bg-surface",
              },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={cn(
                  "group rounded-xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(15,23,42,0.06),0_16px_40px_rgba(15,23,42,0.08)]",
                  action.border
                )}
              >
                <div
                  className={cn(
                    "mb-3 flex h-10 w-10 items-center justify-center rounded-lg shadow-sm transition-transform group-hover:scale-105",
                    action.accent
                  )}
                >
                  <Icon name={action.icon} filled size="md" />
                </div>
                <div className="mb-1 font-headline text-[15px] font-bold tracking-tight text-on-surface">
                  {action.title}
                </div>
                <p className="text-[12.5px] leading-relaxed text-on-surface-variant">
                  {action.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

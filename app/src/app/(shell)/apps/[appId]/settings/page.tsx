"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Icon } from "@/components/shared/Icon";
import { Input } from "@/components/shared/Input";
import { TopBar } from "@/components/shared/TopBar";
import {
  deleteApp,
  getApp,
  listAppVersions,
  publishApp,
  updateApp,
} from "@/lib/api/apps";
import { useToastStore } from "@/stores/toastStore";
import type { App, AppVersionSummary } from "@/types/app";

const STATUS_LABELS: Record<App["status"], string> = {
  draft: "下書き",
  published: "公開中",
  archived: "アーカイブ",
};

const STATUS_VARIANTS: Record<App["status"], "default" | "success" | "warning"> = {
  draft: "warning",
  published: "success",
  archived: "default",
};

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AppSettingsPage() {
  const params = useParams<{ appId: string }>();
  const router = useRouter();
  const appId = Array.isArray(params.appId)
    ? params.appId[0] ?? ""
    : params.appId ?? "";
  const pushToast = useToastStore((store) => store.pushToast);

  const [app, setApp] = useState<App | null>(null);
  const [versions, setVersions] = useState<AppVersionSummary[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("apps");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appId) {
      setError("アプリIDが見つかりません。");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSettings() {
      try {
        setIsLoading(true);
        const [nextApp, nextVersions] = await Promise.all([
          getApp(appId),
          listAppVersions(appId),
        ]);

        if (cancelled) {
          return;
        }

        setApp(nextApp);
        setVersions(nextVersions);
        setName(nextApp.name);
        setDescription(nextApp.description ?? "");
        setIcon(nextApp.icon || "apps");
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "アプリ設定の読み込みに失敗しました。"
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [appId]);

  async function handleSave() {
    if (!app) {
      return;
    }

    try {
      setIsSaving(true);
      const nextApp = await updateApp(app.id, {
        name,
        description,
        icon,
      });
      setApp(nextApp);
      pushToast({ title: "アプリ設定を保存しました", variant: "success" });
    } catch (nextError) {
      pushToast({
        title: "アプリ設定の保存に失敗しました",
        description:
          nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    if (!app) {
      return;
    }

    try {
      setIsPublishing(true);
      const version = await publishApp(app.id);
      setVersions((current) => [version, ...current]);
      setApp((current) =>
        current ? { ...current, status: "published" } : current
      );
      pushToast({
        title: `バージョン v${version.versionNo} を公開しました`,
        variant: "success",
      });
    } catch (nextError) {
      pushToast({
        title: "アプリの公開に失敗しました",
        description:
          nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleArchiveToggle() {
    if (!app) {
      return;
    }

    const nextStatus = app.status === "archived" ? "draft" : "archived";

    try {
      setIsArchiving(true);
      const nextApp = await updateApp(app.id, { status: nextStatus });
      setApp(nextApp);
      pushToast({
        title:
          nextStatus === "archived"
            ? "アプリをアーカイブしました"
            : "アプリを下書きに戻しました",
        variant: "success",
      });
    } catch (nextError) {
      pushToast({
        title: "ステータスの変更に失敗しました",
        description:
          nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleDelete() {
    if (!app) {
      return;
    }

    const confirmed = window.confirm(
      `「${app.name}」を削除しますか？テーブル・レコード・ワークフローもすべて削除されます。この操作は取り消せません。`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteApp(app.id);
      pushToast({ title: "アプリを削除しました", variant: "success" });
      router.push("/home");
    } catch (nextError) {
      pushToast({
        title: "アプリの削除に失敗しました",
        description:
          nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
      setIsDeleting(false);
    }
  }

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "アプリ", href: "/home" },
          { label: app?.name ?? "アプリ設定" },
          { label: "設定" },
        ]}
      />

      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-16 pt-24 md:px-8">
        {error && (
          <div className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {isLoading ? (
          <Card className="animate-pulse">
            <div className="h-5 w-40 rounded bg-surface-container-high" />
            <div className="mt-4 h-9 rounded bg-surface-container" />
            <div className="mt-3 h-9 rounded bg-surface-container" />
          </Card>
        ) : app ? (
          <>
            <Card>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container">
                    <Icon name={icon || "apps"} className="text-on-primary-container" />
                  </div>
                  <div>
                    <h2 className="font-headline text-base font-bold text-on-surface">
                      基本設定
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                      アプリ名や説明を変更します。コード: {app.code}
                    </p>
                  </div>
                </div>
                <Badge variant={STATUS_VARIANTS[app.status]}>
                  {STATUS_LABELS[app.status]}
                </Badge>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                    アプリ名
                  </label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="アプリ名"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                    説明
                  </label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    placeholder="このアプリの目的や対象業務を記載します"
                    className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface placeholder:text-on-surface-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                    アイコン（Material Symbols名）
                  </label>
                  <Input
                    value={icon}
                    onChange={(event) => setIcon(event.target.value)}
                    placeholder="apps"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => void handleSave()}
                    disabled={isSaving || !name.trim()}
                  >
                    <Icon name="save" size="sm" />
                    {isSaving ? "保存中..." : "設定を保存"}
                  </Button>
                </div>
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-headline text-base font-bold text-on-surface">
                    公開とバージョン管理
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    現在の定義をスナップショットとして保存し、アプリを公開します。
                  </p>
                </div>
                <Button
                  onClick={() => void handlePublish()}
                  disabled={isPublishing || app.status === "archived"}
                >
                  <Icon name="rocket_launch" size="sm" />
                  {isPublishing ? "公開中..." : "公開する"}
                </Button>
              </div>

              {versions.length === 0 ? (
                <div className="rounded-lg bg-surface-container p-4 text-center text-xs text-on-surface-variant">
                  まだ公開バージョンはありません。「公開する」で最初のバージョンを作成します。
                </div>
              ) : (
                <ul className="divide-y divide-outline-variant/60">
                  {versions.map((version, index) => (
                    <li
                      key={version.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high text-xs font-bold text-on-surface">
                          v{version.versionNo}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface">
                            {formatDateTime(version.publishedAt)}
                            {index === 0 && (
                              <Badge variant="success">最新</Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-on-surface-variant">
                            {version.publishedByName ?? "不明なユーザー"} ·
                            テーブル {version.tableCount} · ビュー {version.viewCount} ·
                            ワークフロー {version.workflowCount}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-1 font-headline text-base font-bold text-on-surface">
                アーカイブ
              </h2>
              <p className="mb-4 text-xs text-on-surface-variant">
                アーカイブすると、このアプリは一覧で非アクティブ扱いになります。いつでも元に戻せます。
              </p>
              <Button
                variant="secondary"
                onClick={() => void handleArchiveToggle()}
                disabled={isArchiving}
              >
                <Icon
                  name={app.status === "archived" ? "unarchive" : "archive"}
                  size="sm"
                />
                {isArchiving
                  ? "更新中..."
                  : app.status === "archived"
                    ? "下書きに戻す"
                    : "アーカイブする"}
              </Button>
            </Card>

            <Card className="border-error/30">
              <h2 className="mb-1 font-headline text-base font-bold text-error">
                危険な操作
              </h2>
              <p className="mb-4 text-xs text-on-surface-variant">
                アプリを完全に削除します。テーブル・レコード・ワークフロー・添付ファイルがすべて削除され、元に戻せません。
              </p>
              <Button
                variant="danger"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
              >
                <Icon name="delete_forever" size="sm" />
                {isDeleting ? "削除中..." : "アプリを削除"}
              </Button>
            </Card>
          </>
        ) : null}
      </main>
    </>
  );
}

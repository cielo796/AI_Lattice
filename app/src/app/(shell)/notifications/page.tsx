"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { TopBar } from "@/components/shared/TopBar";
import {
  archiveNotification,
  deleteNotification,
  listNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "@/lib/api/notifications";
import type {
  Notification,
  NotificationPreference,
} from "@/types/notification";
import { useToastStore } from "@/stores/toastStore";

const PAGE_SIZE = 20;

const typeLabels: Record<Notification["type"], string> = {
  info: "Info",
  approval: "Approval",
  workflow: "Workflow",
  ai: "AI",
  system: "System",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function upsertNotification(
  current: Notification[],
  updated: Notification,
  filter: "all" | "unread" | "archived"
) {
  if (filter === "unread" && updated.readAt) {
    return current.filter((notification) => notification.id !== updated.id);
  }

  if (filter !== "archived" && updated.archivedAt) {
    return current.filter((notification) => notification.id !== updated.id);
  }

  return current.map((notification) =>
    notification.id === updated.id ? updated : notification
  );
}

export default function NotificationsPage() {
  const pushToast = useToastStore((store) => store.pushToast);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "archived">("all");
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (options: { cursor?: string; append?: boolean } = {}) => {
      try {
        if (options.append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        const page = await listNotifications({
          unreadOnly: filter === "unread",
          archivedOnly: filter === "archived",
          cursor: options.cursor,
          limit: PAGE_SIZE,
        });

        setNotifications((current) =>
          options.append
            ? [...current, ...page.notifications]
            : page.notifications
        );
        setNextCursor(page.nextCursor);
        setUnreadCount(page.unreadCount);
        setError(null);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "通知の読み込みに失敗しました。"
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void listNotificationPreferences()
      .then(setPreferences)
      .catch(() => setPreferences([]));
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(intervalId);
  }, [load]);

  const localUnreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications]
  );

  async function handleRead(notificationId: string) {
    try {
      const updated = await markNotificationRead(notificationId);
      setNotifications((current) => upsertNotification(current, updated, filter));
      setUnreadCount((current) =>
        updated.readAt ? Math.max(0, current - 1) : current
      );
    } catch (nextError) {
      pushToast({
        title: "通知の更新に失敗しました",
        description: nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    }
  }

  async function handleArchive(notificationId: string) {
    try {
      const updated = await archiveNotification(notificationId);
      setNotifications((current) => upsertNotification(current, updated, filter));
      setUnreadCount((current) =>
        updated.readAt ? Math.max(0, current - 1) : current
      );
      pushToast({ title: "通知をアーカイブしました", variant: "success" });
    } catch (nextError) {
      pushToast({
        title: "通知のアーカイブに失敗しました",
        description: nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    }
  }

  async function handleDelete(notificationId: string) {
    try {
      await deleteNotification(notificationId);
      setNotifications((current) =>
        current.filter((notification) => notification.id !== notificationId)
      );
      await load();
      pushToast({ title: "通知を削除しました", variant: "success" });
    } catch (nextError) {
      pushToast({
        title: "通知の削除に失敗しました",
        description: nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    }
  }

  async function handleReadAll() {
    try {
      await markAllNotificationsRead();
      await load();
      pushToast({ title: "すべて既読にしました", variant: "success" });
    } catch (nextError) {
      pushToast({
        title: "通知の更新に失敗しました",
        description: nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    }
  }

  async function handlePreferenceToggle(
    type: Notification["type"],
    enabled: boolean
  ) {
    const nextPreferences = preferences.map((preference) =>
      preference.type === type
        ? { ...preference, inAppEnabled: enabled }
        : preference
    );

    try {
      setIsSavingPreferences(true);
      setPreferences(nextPreferences);
      const saved = await updateNotificationPreferences(nextPreferences);
      setPreferences(saved);
      pushToast({ title: "通知設定を保存しました", variant: "success" });
    } catch (nextError) {
      pushToast({
        title: "通知設定の保存に失敗しました",
        description: nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
      void listNotificationPreferences().then(setPreferences);
    } finally {
      setIsSavingPreferences(false);
    }
  }

  return (
    <>
      <TopBar breadcrumbs={[{ label: "通知" }]} />

      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-16 pt-24 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
              通知
            </h1>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              未読 {unreadCount} 件
              {localUnreadCount !== unreadCount && (
                <span className="ml-1 text-on-surface-muted">
                  （表示中 {localUnreadCount} 件）
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-outline-variant bg-surface p-1">
              {(["all", "unread", "archived"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    filter === value
                      ? "bg-primary text-white"
                      : "text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {value === "all"
                    ? "すべて"
                    : value === "unread"
                      ? "未読"
                      : "アーカイブ"}
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => void handleReadAll()}>
              <Icon name="done_all" size="sm" />
              全既読
            </Button>
          </div>
        </div>

        <section className="rounded-xl border border-outline-variant bg-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-on-surface">受信設定</h2>
              <p className="text-xs text-on-surface-variant">
                アプリ内で受け取る通知タイプを選択します。
              </p>
            </div>
            {isSavingPreferences && (
              <span className="text-xs text-on-surface-muted">保存中...</span>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {preferences.map((preference) => (
              <label
                key={preference.type}
                className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface"
              >
                <span>{typeLabels[preference.type]}</span>
                <input
                  type="checkbox"
                  checked={preference.inAppEnabled}
                  disabled={isSavingPreferences}
                  onChange={(event) =>
                    void handlePreferenceToggle(
                      preference.type,
                      event.target.checked
                    )
                  }
                  className="h-4 w-4 accent-primary"
                />
              </label>
            ))}
          </div>
        </section>

        {error && (
          <div className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface">
          <div className="divide-y divide-outline-variant/60">
            {isLoading ? (
              <div className="px-4 py-10 text-center text-xs text-on-surface-variant">
                <Icon
                  name="progress_activity"
                  className="mr-1 animate-spin align-middle"
                  size="sm"
                />
                読み込み中...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-on-surface-variant">
                通知はありません。
              </div>
            ) : (
              notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`flex gap-3 px-4 py-3 ${
                    notification.readAt ? "bg-surface" : "bg-primary-container/30"
                  }`}
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                    <Icon
                      name={
                        notification.type === "approval"
                          ? "approval"
                          : notification.type === "ai"
                            ? "auto_awesome"
                            : "notifications"
                      }
                      size="sm"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-on-surface">
                        {notification.title}
                      </h2>
                      <Badge variant={notification.readAt ? "default" : "info"}>
                        {notification.readAt ? "既読" : "未読"}
                      </Badge>
                      {notification.archivedAt && (
                        <Badge variant="warning">アーカイブ</Badge>
                      )}
                      <Badge variant="default">
                        {typeLabels[notification.type]}
                      </Badge>
                    </div>
                    {notification.body && (
                      <p className="mt-1 text-[12.5px] leading-relaxed text-on-surface-variant">
                        {notification.body}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-on-surface-muted">
                      <span>{formatDate(notification.createdAt)}</span>
                      {notification.actorName && <span>{notification.actorName}</span>}
                      {notification.appName && <span>{notification.appName}</span>}
                      <span>{notification.deliveryStatus}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    {notification.href && (
                      <Link
                        href={notification.href}
                        className="inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-semibold text-primary hover:bg-primary-container"
                        onClick={() => void handleRead(notification.id)}
                      >
                        開く
                      </Link>
                    )}
                    {!notification.readAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleRead(notification.id)}
                      >
                        <Icon name="done" size="sm" />
                        既読
                      </Button>
                    )}
                    {!notification.archivedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleArchive(notification.id)}
                      >
                        <Icon name="archive" size="sm" />
                        保管
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(notification.id)}
                    >
                      <Icon name="delete" size="sm" />
                      削除
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {nextCursor && !isLoading && (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              onClick={() => void load({ cursor: nextCursor, append: true })}
              disabled={isLoadingMore}
            >
              <Icon name={isLoadingMore ? "progress_activity" : "expand_more"} size="sm" />
              {isLoadingMore ? "読み込み中..." : "さらに読み込む"}
            </Button>
          </div>
        )}
      </main>
    </>
  );
}

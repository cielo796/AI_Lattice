"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { TopBar } from "@/components/shared/TopBar";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import type { Notification } from "@/types/notification";
import { useToastStore } from "@/stores/toastStore";

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

export default function NotificationsPage() {
  const pushToast = useToastStore((store) => store.pushToast);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const nextNotifications = await listNotifications({
        unreadOnly: filter === "unread",
      });

      setNotifications(nextNotifications);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "通知の読み込みに失敗しました。"
      );
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications]
  );

  async function handleRead(notificationId: string) {
    try {
      const updated = await markNotificationRead(notificationId);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === updated.id ? updated : notification
        )
      );
    } catch (nextError) {
      pushToast({
        title: "通知の更新に失敗しました",
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

  return (
    <>
      <TopBar breadcrumbs={[{ label: "通知" }]} />

      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-16 pt-24 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
              通知
            </h1>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              未読 {unreadCount} 件
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-outline-variant bg-surface p-1">
              {(["all", "unread"] as const).map((value) => (
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
                  {value === "all" ? "すべて" : "未読"}
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => void handleReadAll()}>
              <Icon name="done_all" size="sm" />
              全既読
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface">
          <div className="divide-y divide-outline-variant/60">
            {isLoading ? (
              <div className="px-4 py-10 text-center text-xs text-on-surface-variant">
                <Icon name="progress_activity" className="mr-1 animate-spin align-middle" size="sm" />
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
                      <Badge variant="default">{typeLabels[notification.type]}</Badge>
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
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
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
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}

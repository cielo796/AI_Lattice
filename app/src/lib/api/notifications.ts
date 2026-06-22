import { apiFetch } from "@/lib/api/client";
import type { Notification } from "@/types/notification";

export async function listNotifications(options: { unreadOnly?: boolean } = {}) {
  return apiFetch<Notification[]>("/api/notifications", {
    query: {
      unread: options.unreadOnly ? "true" : undefined,
    },
  });
}

export async function markNotificationRead(notificationId: string) {
  return apiFetch<Notification>(`/api/notifications/${notificationId}`, {
    method: "PATCH",
  });
}

export async function markAllNotificationsRead() {
  await apiFetch<string>("/api/notifications/read-all", { method: "POST" });
}


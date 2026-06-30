import { apiFetch } from "@/lib/api/client";
import type {
  Notification,
  NotificationPage,
  NotificationPreference,
} from "@/types/notification";

export async function listNotifications(
  options: {
    unreadOnly?: boolean;
    archivedOnly?: boolean;
    cursor?: string;
    limit?: number;
  } = {}
) {
  return apiFetch<NotificationPage>("/api/notifications", {
    query: {
      unread: options.unreadOnly ? "true" : undefined,
      archived: options.archivedOnly ? "true" : undefined,
      cursor: options.cursor,
      limit: options.limit,
    },
  });
}

export async function markNotificationRead(notificationId: string) {
  return apiFetch<Notification>(`/api/notifications/${notificationId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "read" }),
  });
}

export async function archiveNotification(notificationId: string) {
  return apiFetch<Notification>(`/api/notifications/${notificationId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "archive" }),
  });
}

export async function deleteNotification(notificationId: string) {
  await apiFetch<string>(`/api/notifications/${notificationId}`, {
    method: "DELETE",
  });
}

export async function markAllNotificationsRead() {
  await apiFetch<string>("/api/notifications/read-all", { method: "POST" });
}

export async function getUnreadNotificationCount() {
  return apiFetch<{ count: number }>("/api/notifications/unread-count");
}

export async function listNotificationPreferences() {
  return apiFetch<NotificationPreference[]>("/api/notifications/preferences");
}

export async function updateNotificationPreferences(
  preferences: NotificationPreference[]
) {
  return apiFetch<NotificationPreference[]>("/api/notifications/preferences", {
    method: "PUT",
    body: JSON.stringify({ preferences }),
  });
}

export interface Notification {
  id: string;
  tenantId: string;
  recipientId: string;
  actorId?: string;
  actorName?: string;
  appId?: string;
  appName?: string;
  recordId?: string;
  type: "info" | "approval" | "workflow" | "ai" | "system";
  title: string;
  body?: string;
  href?: string;
  dedupeKey?: string;
  deliveryStatus: "queued" | "sent" | "failed" | "skipped";
  deliveryError?: string;
  deliveredAt?: string;
  readAt?: string;
  archivedAt?: string;
  deletedAt?: string;
  createdAt: string;
}

export interface NotificationPage {
  notifications: Notification[];
  nextCursor?: string;
  unreadCount: number;
}

export interface NotificationPreference {
  type: Notification["type"];
  inAppEnabled: boolean;
}

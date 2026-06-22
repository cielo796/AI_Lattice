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
  readAt?: string;
  createdAt: string;
}


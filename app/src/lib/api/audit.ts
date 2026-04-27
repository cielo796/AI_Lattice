import { apiFetch } from "@/lib/api/client";
import type { AuditLog } from "@/types/audit";

export interface ListAuditLogsOptions {
  limit?: number;
  actionType?: string;
  resourceType?: string;
}

export async function listAuditLogs(options: ListAuditLogsOptions = {}) {
  return apiFetch<AuditLog[]>("/api/admin/audit-logs", {
    query: { ...options },
  });
}

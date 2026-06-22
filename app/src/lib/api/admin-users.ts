import { apiFetch } from "@/lib/api/client";

export interface AdminUserSummary {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  status: "active" | "inactive";
  lastLoginAt?: string;
  createdAt: string;
  appCount: number;
  recordCount: number;
}

export async function listAdminUsers() {
  return apiFetch<AdminUserSummary[]>("/api/admin/users");
}

export async function updateAdminUserStatus(
  userId: string,
  status: "active" | "inactive"
) {
  return apiFetch<AdminUserSummary>(`/api/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

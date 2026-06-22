import { apiFetch } from "@/lib/api/client";
import type { Tenant } from "@/types/user";

export interface UpdateTenantInput {
  name?: string;
  code?: string;
  status?: Tenant["status"];
  planType?: string;
}

export async function getTenantSettings() {
  return apiFetch<Tenant>("/api/admin/tenant");
}

export async function listAvailableTenants() {
  return apiFetch<Tenant[]>("/api/tenants");
}

export async function updateTenantSettings(input: UpdateTenantInput) {
  return apiFetch<Tenant>("/api/admin/tenant", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

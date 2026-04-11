export interface Tenant {
  id: string;
  name: string;
  code: string;
  status: "active" | "inactive";
  planType: string;
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  status: "active" | "inactive";
  lastLoginAt?: string;
  createdAt: string;
}

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  roleType: "system_admin" | "tenant_admin" | "app_admin" | "approver" | "user" | "viewer";
  createdAt: string;
}

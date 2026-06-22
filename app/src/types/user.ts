export interface Tenant {
  id: string;
  name: string;
  code: string;
  status: "active" | "inactive";
  planType: string;
  createdAt: string;
  updatedAt?: string;
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
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt?: string;
  assignmentCount?: number;
}

export interface UserRoleAssignment {
  id: string;
  tenantId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  roleId: string;
  roleName?: string;
  roleType?: Role["roleType"];
  appId?: string;
  appName?: string;
  tableId?: string;
  tableName?: string;
  createdBy?: string;
  createdAt: string;
}

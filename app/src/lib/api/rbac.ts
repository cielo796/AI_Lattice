import { apiFetch } from "@/lib/api/client";
import type { Role, UserRoleAssignment } from "@/types/user";

export interface CreateRoleInput {
  name: string;
  roleType: Role["roleType"];
  permissions: string[];
}

export interface UpdateRoleInput {
  name?: string;
  roleType?: Role["roleType"];
  permissions?: string[];
}

export interface AssignRoleInput {
  userId: string;
  roleId: string;
  appId?: string;
  tableId?: string;
}

export const PERMISSION_LABELS: Record<string, string> = {
  "admin:users": "ユーザー管理",
  "admin:roles": "ロール管理",
  "admin:tenant": "テナント設定",
  "admin:prompt_templates": "Prompt Template 管理",
  "admin:audit_logs": "監査ログ",
  "admin:ai_logs": "AI実行ログ",
  "admin:openai": "OpenAI 設定",
  "app:read": "アプリ閲覧",
  "app:write": "アプリ編集",
  "app:publish": "アプリ公開",
  "app:delete": "アプリ削除",
  "table:read": "テーブル閲覧",
  "table:write": "テーブル編集",
  "record:read": "レコード閲覧",
  "record:write": "レコード編集",
  "workflow:read": "Workflow 閲覧",
  "workflow:manage": "Workflow 管理",
  "approval:manage": "承認操作",
  "ai:execute": "AI 実行",
  "notifications:read": "通知閲覧",
  "notifications:manage": "通知管理",
};

export const PERMISSIONS = Object.keys(PERMISSION_LABELS);

export type PermissionMap = Record<string, boolean>;

export function getCurrentPermissions(scope: { appId?: string; tableId?: string } = {}) {
  return apiFetch<PermissionMap>("/api/auth/permissions", { query: scope });
}

export async function listRoles() {
  return apiFetch<Role[]>("/api/admin/roles");
}

export async function createRole(input: CreateRoleInput) {
  return apiFetch<Role>("/api/admin/roles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateRole(roleId: string, input: UpdateRoleInput) {
  return apiFetch<Role>(`/api/admin/roles/${roleId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteRole(roleId: string) {
  await apiFetch<string>(`/api/admin/roles/${roleId}`, { method: "DELETE" });
}

export async function listRoleAssignments() {
  return apiFetch<UserRoleAssignment[]>("/api/admin/role-assignments");
}

export async function assignRole(input: AssignRoleInput) {
  return apiFetch<UserRoleAssignment>("/api/admin/role-assignments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function revokeRoleAssignment(assignmentId: string) {
  await apiFetch<string>(`/api/admin/role-assignments/${assignmentId}`, {
    method: "DELETE",
  });
}

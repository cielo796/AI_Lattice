"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { Input } from "@/components/shared/Input";
import { TopBar } from "@/components/shared/TopBar";
import { listAdminUsers, type AdminUserSummary } from "@/lib/api/admin-users";
import {
  assignRole,
  createRole,
  listRoleAssignments,
  listRoles,
  PERMISSION_LABELS,
  PERMISSIONS,
  revokeRoleAssignment,
} from "@/lib/api/rbac";
import type { Role, UserRoleAssignment } from "@/types/user";
import { useToastStore } from "@/stores/toastStore";

const roleTypeLabels: Record<Role["roleType"], string> = {
  system_admin: "System Admin",
  tenant_admin: "Tenant Admin",
  app_admin: "App Admin",
  approver: "Approver",
  user: "User",
  viewer: "Viewer",
};

const permissionGroups = [
  { label: "管理", prefix: "admin:" },
  { label: "アプリ", prefix: "app:" },
  { label: "テーブル", prefix: "table:" },
  { label: "レコード", prefix: "record:" },
  { label: "Workflow", prefix: "workflow:" },
  { label: "その他", prefix: "" },
];

function formatScope(assignment: UserRoleAssignment) {
  if (assignment.tableName) {
    return assignment.tableName;
  }

  if (assignment.appName) {
    return assignment.appName;
  }

  return "テナント全体";
}

export default function AdminRolesPage() {
  const pushToast = useToastStore((store) => store.pushToast);
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([]);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [roleName, setRoleName] = useState("");
  const [roleType, setRoleType] = useState<Role["roleType"]>("user");
  const [permissions, setPermissions] = useState<string[]>(["app:read", "record:read"]);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setIsLoading(true);
      const [nextRoles, nextAssignments, nextUsers] = await Promise.all([
        listRoles(),
        listRoleAssignments(),
        listAdminUsers(),
      ]);

      setRoles(nextRoles);
      setAssignments(nextAssignments);
      setUsers(nextUsers);
      setAssignRoleId(nextRoles[0]?.id ?? "");
      setAssignUserId(nextUsers[0]?.id ?? "");
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "ロール情報の読み込みに失敗しました。"
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const customRoles = useMemo(
    () => roles.filter((role) => !role.isSystem).length,
    [roles]
  );

  function togglePermission(permission: string) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  }

  async function handleCreateRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSaving(true);
      const role = await createRole({
        name: roleName,
        roleType,
        permissions,
      });

      setRoles((current) => [...current, role]);
      setRoleName("");
      pushToast({ title: "ロールを作成しました", variant: "success" });
    } catch (nextError) {
      pushToast({
        title: "ロール作成に失敗しました",
        description: nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAssignRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const assignment = await assignRole({
        userId: assignUserId,
        roleId: assignRoleId,
      });

      setAssignments((current) => [assignment, ...current]);
      pushToast({ title: "ロールを割り当てました", variant: "success" });
    } catch (nextError) {
      pushToast({
        title: "ロール割り当てに失敗しました",
        description: nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    }
  }

  async function handleRevoke(assignmentId: string) {
    try {
      await revokeRoleAssignment(assignmentId);
      setAssignments((current) =>
        current.filter((assignment) => assignment.id !== assignmentId)
      );
      pushToast({ title: "ロール割り当てを解除しました", variant: "success" });
    } catch (nextError) {
      pushToast({
        title: "解除に失敗しました",
        description: nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    }
  }

  return (
    <>
      <TopBar breadcrumbs={[{ label: "管理" }, { label: "ロール管理" }]} />

      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-16 pt-24 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
              ロール管理
            </h1>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              ロール {roles.length} 件、カスタム {customRoles} 件、割り当て {assignments.length} 件
            </p>
          </div>
          <Button variant="ghost" onClick={() => void load()} disabled={isLoading}>
            <Icon name="refresh" size="sm" />
            更新
          </Button>
        </div>

        {error && (
          <div className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface">
            <table className="w-full text-left">
              <thead className="bg-surface-container text-[10.5px] font-bold uppercase tracking-wider text-on-surface-variant">
                <tr>
                  <th className="px-4 py-3">ロール</th>
                  <th className="px-4 py-3">権限</th>
                  <th className="px-4 py-3">割り当て</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-xs text-on-surface-variant">
                      <Icon name="progress_activity" className="mr-1 animate-spin align-middle" size="sm" />
                      読み込み中...
                    </td>
                  </tr>
                ) : (
                  roles.map((role) => (
                    <tr key={role.id} className="align-top text-[12.5px]">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-on-surface">{role.name}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <Badge variant={role.isSystem ? "info" : "default"}>
                            {roleTypeLabels[role.roleType]}
                          </Badge>
                          {role.isSystem && <Badge variant="success">system</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-2xl flex-wrap gap-1">
                          {role.permissions.includes("*") ? (
                            <Badge variant="warning">全権限</Badge>
                          ) : (
                            role.permissions.slice(0, 8).map((permission) => (
                              <Badge key={permission}>
                                {PERMISSION_LABELS[permission] ?? permission}
                              </Badge>
                            ))
                          )}
                          {role.permissions.length > 8 && (
                            <Badge>+{role.permissions.length - 8}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {role.assignmentCount ?? 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <aside className="space-y-5">
            <form
              onSubmit={(event) => void handleCreateRole(event)}
              className="rounded-xl border border-outline-variant bg-surface p-4"
            >
              <h2 className="mb-3 font-headline text-base font-bold text-on-surface">
                カスタムロール
              </h2>
              <div className="space-y-3">
                <Input
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  placeholder="例: 外部閲覧者"
                />
                <select
                  value={roleType}
                  onChange={(event) => setRoleType(event.target.value as Role["roleType"])}
                  className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {Object.entries(roleTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <div className="max-h-72 space-y-3 overflow-auto rounded-lg border border-outline-variant p-3">
                  {permissionGroups.map((group) => {
                    const groupPermissions = PERMISSIONS.filter((permission) =>
                      group.prefix
                        ? permission.startsWith(group.prefix)
                        : !permission.startsWith("admin:") &&
                          !permission.startsWith("app:") &&
                          !permission.startsWith("table:") &&
                          !permission.startsWith("record:") &&
                          !permission.startsWith("workflow:")
                    );

                    return (
                      <div key={group.label}>
                        <div className="mb-1 text-[11px] font-bold text-on-surface-variant">
                          {group.label}
                        </div>
                        <div className="space-y-1">
                          {groupPermissions.map((permission) => (
                            <label
                              key={permission}
                              className="flex items-center gap-2 text-xs text-on-surface"
                            >
                              <input
                                type="checkbox"
                                checked={permissions.includes(permission)}
                                onChange={() => togglePermission(permission)}
                              />
                              {PERMISSION_LABELS[permission]}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button type="submit" disabled={isSaving || !roleName.trim()}>
                  <Icon name="add" size="sm" />
                  作成
                </Button>
              </div>
            </form>

            <form
              onSubmit={(event) => void handleAssignRole(event)}
              className="rounded-xl border border-outline-variant bg-surface p-4"
            >
              <h2 className="mb-3 font-headline text-base font-bold text-on-surface">
                ユーザー割り当て
              </h2>
              <div className="space-y-3">
                <select
                  value={assignUserId}
                  onChange={(event) => setAssignUserId(event.target.value)}
                  className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px]"
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} / {user.email}
                    </option>
                  ))}
                </select>
                <select
                  value={assignRoleId}
                  onChange={(event) => setAssignRoleId(event.target.value)}
                  className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px]"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" disabled={!assignUserId || !assignRoleId}>
                  <Icon name="person_add" size="sm" />
                  割り当て
                </Button>
              </div>
            </form>
          </aside>
        </div>

        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface">
          <div className="border-b border-outline-variant px-4 py-3 font-headline text-base font-bold">
            割り当て一覧
          </div>
          <table className="w-full text-left">
            <tbody className="divide-y divide-outline-variant/60">
              {assignments.map((assignment) => (
                <tr key={assignment.id} className="text-[12.5px]">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-on-surface">
                      {assignment.userName ?? assignment.userId}
                    </div>
                    <div className="text-[11px] text-on-surface-variant">
                      {assignment.userEmail}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="info">{assignment.roleName}</Badge>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {formatScope(assignment)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRevoke(assignment.id)}
                    >
                      <Icon name="link_off" size="sm" />
                      解除
                    </Button>
                  </td>
                </tr>
              ))}
              {!isLoading && assignments.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-xs text-on-surface-variant">
                    ロール割り当てはまだありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}


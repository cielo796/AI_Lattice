"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { TopBar } from "@/components/shared/TopBar";
import { getApp, listTables } from "@/lib/api/apps";
import { listAdminUsers, type AdminUserSummary } from "@/lib/api/admin-users";
import {
  assignRole,
  listRoleAssignments,
  listRoles,
  revokeRoleAssignment,
} from "@/lib/api/rbac";
import type { App, AppTable } from "@/types/app";
import type { Role, UserRoleAssignment } from "@/types/user";
import { useToastStore } from "@/stores/toastStore";

export default function AppPermissionsPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = use(params);
  const pushToast = useToastStore((store) => store.pushToast);
  const [app, setApp] = useState<App | null>(null);
  const [tables, setTables] = useState<AppTable[]>([]);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([]);
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [tableId, setTableId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [nextApp, nextTables, nextUsers, nextRoles, nextAssignments] = await Promise.all([
        getApp(appId),
        listTables(appId),
        listAdminUsers(),
        listRoles(),
        listRoleAssignments(),
      ]);
      setApp(nextApp);
      setTables(nextTables);
      setUsers(nextUsers);
      setRoles(nextRoles);
      setAssignments(nextAssignments);
      setUserId((current) => current || nextUsers[0]?.id || "");
      setRoleId((current) => current || nextRoles[0]?.id || "");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "権限情報の読み込みに失敗しました。");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  const scopedAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.appId === appId),
    [appId, assignments]
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const assignment = await assignRole({
        userId,
        roleId,
        appId,
        tableId: tableId || undefined,
      });
      setAssignments((current) => [assignment, ...current]);
      pushToast({ title: "アプリ権限を割り当てました", variant: "success" });
    } catch (nextError) {
      pushToast({ title: "権限割り当てに失敗しました", description: nextError instanceof Error ? nextError.message : undefined, variant: "error" });
    }
  }

  async function revoke(assignmentId: string) {
    try {
      await revokeRoleAssignment(assignmentId);
      setAssignments((current) => current.filter((item) => item.id !== assignmentId));
      pushToast({ title: "権限を解除しました", variant: "success" });
    } catch (nextError) {
      pushToast({ title: "解除に失敗しました", description: nextError instanceof Error ? nextError.message : undefined, variant: "error" });
    }
  }

  return (
    <>
      <TopBar title="権限設計" breadcrumbs={[{ label: app?.name ?? "アプリ" }, { label: "権限" }]} />
      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-16 pt-24 md:px-8">
        <div><h1 className="font-headline text-xl font-extrabold text-on-surface">{app?.name ?? "アプリ"} の権限</h1><p className="mt-1 text-xs text-on-surface-variant">ロールをアプリ全体またはテーブル単位で割り当てます。</p></div>
        {error && <div className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}

        <form onSubmit={(event) => void submit(event)} className="grid gap-3 rounded-lg border border-outline-variant bg-surface p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <label className="text-xs font-semibold text-on-surface">ユーザー<select value={userId} onChange={(event) => setUserId(event.target.value)} className="mt-1.5 w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm">{users.map((user) => <option key={user.id} value={user.id}>{user.name} / {user.email}</option>)}</select></label>
          <label className="text-xs font-semibold text-on-surface">ロール<select value={roleId} onChange={(event) => setRoleId(event.target.value)} className="mt-1.5 w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm">{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
          <label className="text-xs font-semibold text-on-surface">対象<select value={tableId} onChange={(event) => setTableId(event.target.value)} className="mt-1.5 w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm"><option value="">アプリ全体</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}</select></label>
          <Button type="submit" disabled={!userId || !roleId}><Icon name="person_add" size="sm" />割り当て</Button>
        </form>

        <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_70px] gap-3 border-b border-outline-variant bg-surface-container px-4 py-3 text-[11px] font-bold text-on-surface-variant"><span>ユーザー</span><span>ロール</span><span>scope</span><span /></div>
          <div className="divide-y divide-outline-variant">
            {scopedAssignments.length === 0 ? <div className="px-4 py-10 text-center text-sm text-on-surface-variant">アプリ固有の割り当てはありません。</div> : scopedAssignments.map((assignment) => (
              <div key={assignment.id} className="grid grid-cols-[1.2fr_1fr_1fr_70px] items-center gap-3 px-4 py-3 text-sm">
                <div><div className="font-semibold text-on-surface">{assignment.userName}</div><div className="text-[11px] text-on-surface-variant">{assignment.userEmail}</div></div>
                <div><Badge variant="info">{assignment.roleName}</Badge></div>
                <div className="text-xs text-on-surface-variant">{assignment.tableName ?? "アプリ全体"}</div>
                <Button variant="ghost" size="sm" onClick={() => void revoke(assignment.id)} aria-label="権限を解除"><Icon name="link_off" size="sm" /></Button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}


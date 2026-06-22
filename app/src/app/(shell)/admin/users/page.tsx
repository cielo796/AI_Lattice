"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/shared/Avatar";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { Input } from "@/components/shared/Input";
import { TopBar } from "@/components/shared/TopBar";
import {
  listAdminUsers,
  updateAdminUserStatus,
  type AdminUserSummary,
} from "@/lib/api/admin-users";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";

function formatDateTime(value: string | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminUsersPage() {
  const currentUser = useAuthStore((store) => store.user);
  const pushToast = useToastStore((store) => store.pushToast);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      try {
        setIsLoading(true);
        const nextUsers = await listAdminUsers();

        if (!cancelled) {
          setUsers(nextUsers);
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "ユーザーの読み込みに失敗しました。"
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) {
      return users;
    }

    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword)
    );
  }, [searchText, users]);

  const activeCount = users.filter((user) => user.status === "active").length;

  async function handleToggleStatus(target: AdminUserSummary) {
    const nextStatus = target.status === "active" ? "inactive" : "active";
    const confirmed =
      nextStatus === "inactive"
        ? window.confirm(
            `「${target.name}」を無効化しますか？このユーザーのセッションはすべて終了します。`
          )
        : true;

    if (!confirmed) {
      return;
    }

    try {
      setUpdatingUserId(target.id);
      const updated = await updateAdminUserStatus(target.id, nextStatus);
      setUsers((current) =>
        current.map((user) => (user.id === updated.id ? updated : user))
      );
      pushToast({
        title:
          nextStatus === "inactive"
            ? `${updated.name} を無効化しました`
            : `${updated.name} を有効化しました`,
        variant: "success",
      });
    } catch (nextError) {
      pushToast({
        title: "ユーザーの更新に失敗しました",
        description:
          nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    } finally {
      setUpdatingUserId(null);
    }
  }

  return (
    <>
      <TopBar breadcrumbs={[{ label: "管理" }, { label: "ユーザー管理" }]} />

      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-16 pt-24 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
              ユーザー管理
            </h1>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              テナント内のユーザー {users.length} 名（有効 {activeCount} 名）
            </p>
          </div>
          <div className="w-full max-w-xs">
            <Input
              icon="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="名前またはメールで検索"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container text-[10.5px] font-bold uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">ユーザー</th>
                <th className="hidden px-4 py-3 md:table-cell">最終ログイン</th>
                <th className="hidden px-4 py-3 lg:table-cell">作成アプリ</th>
                <th className="hidden px-4 py-3 lg:table-cell">作成レコード</th>
                <th className="px-4 py-3">ステータス</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-xs text-on-surface-variant"
                  >
                    <Icon
                      name="progress_activity"
                      className="mr-1 animate-spin align-middle"
                      size="sm"
                    />
                    ユーザーを読み込み中...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-xs text-on-surface-variant"
                  >
                    条件に一致するユーザーが見つかりません。
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="text-[12.5px] text-on-surface transition-colors hover:bg-surface-container-low"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} size="md" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-semibold">
                            {user.name}
                            {user.id === currentUser?.id && (
                              <Badge variant="info">自分</Badge>
                            )}
                          </div>
                          <div className="truncate text-[11px] text-on-surface-variant">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-on-surface-variant md:table-cell">
                      {formatDateTime(user.lastLoginAt)}
                    </td>
                    <td className="hidden px-4 py-3 text-on-surface-variant lg:table-cell">
                      {user.appCount}
                    </td>
                    <td className="hidden px-4 py-3 text-on-surface-variant lg:table-cell">
                      {user.recordCount}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={user.status === "active" ? "success" : "default"}
                      >
                        {user.status === "active" ? "有効" : "無効"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={
                          updatingUserId === user.id ||
                          user.id === currentUser?.id
                        }
                        onClick={() => void handleToggleStatus(user)}
                      >
                        {updatingUserId === user.id
                          ? "更新中..."
                          : user.status === "active"
                            ? "無効化"
                            : "有効化"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

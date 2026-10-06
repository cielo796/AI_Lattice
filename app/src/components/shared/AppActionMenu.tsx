"use client";

import Link from "next/link";
import { Icon } from "./Icon";
import { OverflowMenu } from "./OverflowMenu";
import type { App } from "@/types/app";

export function AppActionMenu({ app, deleting, onDelete }: { app: App; deleting: boolean; onDelete: () => void }) {
  return (
    <OverflowMenu label={`${app.name}のその他の操作`}>
      <Link href={`/apps/${app.id}/tables`} className="flex items-center gap-2 rounded px-3 py-2 hover:bg-surface-container"><Icon name="edit" size="sm" />テーブルを編集</Link>
      <Link href={`/apps/${app.id}/settings`} className="flex items-center gap-2 rounded px-3 py-2 hover:bg-surface-container"><Icon name="settings" size="sm" />アプリ設定</Link>
      <button type="button" data-testid={`delete-app-${app.id}`} disabled={deleting} onClick={onDelete} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-error hover:bg-error-container"><Icon name="delete" size="sm" />{deleting ? "削除中..." : "削除"}</button>
    </OverflowMenu>
  );
}

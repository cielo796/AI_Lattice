import { redirect } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { getVisibleAdminTabs } from "@/lib/shell-navigation";
import { getPermissionMap } from "@/server/admin/rbac";
import { getAuthenticatedUser } from "@/server/auth/service";

export default async function AdminPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const [firstTab] = getVisibleAdminTabs(await getPermissionMap(user));
  if (firstTab) redirect(firstTab.href);

  return (
    <>
      <TopBar title="管理" />
      <main className="mx-auto max-w-5xl px-4 pt-20 md:px-8">
        <h1 className="text-lg font-semibold text-on-surface">管理する権限がありません</h1>
      </main>
    </>
  );
}

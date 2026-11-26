import { ShellChromeProvider } from "@/components/shared/ShellChrome";
import { DatabaseSetupNotice } from "@/components/shared/DatabaseSetupNotice";
import { GuideProvider } from "@/components/guide/GuideProvider";
import { Sidebar } from "@/components/shared/Sidebar";
import { ShellContent } from "@/components/shared/ShellContent";
import { redirect } from "next/navigation";
import { listAppsForUser } from "@/server/apps/service";
import { getAuthenticatedUser } from "@/server/auth/service";
import { getPermissionMap } from "@/server/admin/rbac";
import {
  isDatabaseSetupError,
  toDatabaseSetupErrorBody,
} from "@/server/db/setup-errors";
import type { App } from "@/types/app";
import type { PermissionMap } from "@/lib/shell-navigation";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  let initialApps: App[] = [];
  let permissions: PermissionMap = {};

  try {
    user = await getAuthenticatedUser();
    if (user) {
      [initialApps, permissions] = await Promise.all([
        listAppsForUser(user),
        getPermissionMap(user),
      ]);
    }
  } catch (error) {
    if (isDatabaseSetupError(error)) {
      const body = toDatabaseSetupErrorBody(error);

      return (
        <DatabaseSetupNotice
          message={body.message}
          adminHint={body.adminHint}
          healthCheckPath={body.healthCheckPath}
        />
      );
    }

    throw error;
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <ShellChromeProvider permissions={permissions}>
      <GuideProvider>
        <div className="min-h-screen bg-surface-container-low">
          <Sidebar initialApps={initialApps} userName={user.name} />
          <ShellContent>
            {children}
          </ShellContent>
        </div>
      </GuideProvider>
    </ShellChromeProvider>
  );
}

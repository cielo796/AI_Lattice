import { ShellChromeProvider } from "@/components/shared/ShellChrome";
import { DatabaseSetupNotice } from "@/components/shared/DatabaseSetupNotice";
import { Sidebar } from "@/components/shared/Sidebar";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/server/auth/service";
import {
  isDatabaseSetupError,
  toDatabaseSetupErrorBody,
} from "@/server/db/setup-errors";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;

  try {
    user = await getAuthenticatedUser();
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
    <ShellChromeProvider>
      <div className="min-h-screen bg-surface-container-low">
        <Sidebar />
        <div className="min-h-screen md:ml-64">{children}</div>
      </div>
    </ShellChromeProvider>
  );
}

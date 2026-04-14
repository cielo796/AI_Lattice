import { Sidebar } from "@/components/shared/Sidebar";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/server/auth/service";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <div className="ml-64 min-h-screen">{children}</div>
    </div>
  );
}

import { Sidebar } from "@/components/shared/Sidebar";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <div className="ml-64 min-h-screen">{children}</div>
    </div>
  );
}

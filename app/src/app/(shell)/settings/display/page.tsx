import { DisplaySettingsPanel } from "@/components/shared/DisplaySettingsPanel";
import { TopBar } from "@/components/shared/TopBar";

export default function DisplaySettingsPage() {
  return (
    <>
      <TopBar title="表示設定" breadcrumbs={[{ label: "プロフィール", href: "/settings/profile" }, { label: "表示設定" }]} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 md:px-8">
        <h1 className="mb-5 text-[22px] font-bold">表示設定</h1>
        <DisplaySettingsPanel />
      </main>
    </>
  );
}

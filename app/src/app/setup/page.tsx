import Link from "next/link";
import { SetupForm } from "@/components/auth/SetupForm";
import { DatabaseSetupNotice } from "@/components/shared/DatabaseSetupNotice";
import { isDatabaseSetupError, toDatabaseSetupErrorBody } from "@/server/db/setup-errors";
import { getSetupStatus } from "@/server/setup/service";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  let available: boolean;
  try {
    ({ available } = await getSetupStatus());
  } catch (error) {
    if (isDatabaseSetupError(error)) {
      return <DatabaseSetupNotice {...toDatabaseSetupErrorBody(error)} />;
    }
    throw error;
  }

  return (
    <main className="min-h-screen bg-surface-container-low px-6 py-12">
      <section className="mx-auto max-w-lg rounded-2xl border border-outline-variant bg-surface p-7 shadow-lg">
        <p className="mb-2 text-sm font-bold text-primary">AI Lattice</p>
        <h1 className="mb-3 text-2xl font-extrabold">組織の初期設定</h1>
        {available ? (
          <>
            <p className="mb-7 text-sm leading-relaxed text-on-surface-variant">組織と最初の管理者を登録して、業務アプリを作りはじめましょう。この設定は一度だけ実行できます。</p>
            <SetupForm />
          </>
        ) : (
          <div className="space-y-4 text-sm text-on-surface-variant">
            <p>初期設定は完了しているか、設置担当者によって無効化されています。利用を開始できない場合は設置担当者にお問い合わせください。</p>
            <Link href="/login" className="inline-block font-semibold text-primary hover:underline">ログインへ戻る</Link>
          </div>
        )}
      </section>
    </main>
  );
}

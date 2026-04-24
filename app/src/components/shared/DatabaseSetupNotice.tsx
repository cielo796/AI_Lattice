interface DatabaseSetupNoticeProps {
  message: string;
  adminHint: string;
  healthCheckPath: string;
}

export function DatabaseSetupNotice({
  message,
  adminHint,
  healthCheckPath,
}: DatabaseSetupNoticeProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6 text-on-surface">
      <section className="w-full max-w-2xl rounded-xl border border-error/30 bg-surface-container p-8 shadow-2xl">
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-error">
          Database setup required
        </div>
        <h1 className="mb-3 font-headline text-2xl font-extrabold text-white">
          データベースのセットアップが未完了です
        </h1>
        <p className="mb-5 text-sm leading-relaxed text-on-surface-variant">
          {message}
        </p>
        <div className="space-y-3 rounded-lg bg-surface-container-high p-4 text-sm">
          <div>
            <div className="mb-1 text-xs font-bold text-on-surface-variant">
              管理者向け確認
            </div>
            <p className="text-on-surface">{adminHint}</p>
          </div>
          <div>
            <div className="mb-1 text-xs font-bold text-on-surface-variant">
              Health check
            </div>
            <code className="text-primary">{healthCheckPath}</code>
          </div>
        </div>
      </section>
    </main>
  );
}

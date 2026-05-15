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
    <main className="flex min-h-screen items-center justify-center bg-surface-container-low px-6 text-on-surface">
      <section className="w-full max-w-2xl rounded-2xl border border-error-container bg-surface p-8 shadow-[0_4px_8px_rgba(15,23,42,0.06),0_16px_40px_rgba(15,23,42,0.08)]">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-error-container px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-on-error-container">
          Database setup required
        </div>
        <h1 className="mb-3 font-headline text-2xl font-extrabold tracking-tight text-on-surface">
          データベースのセットアップが未完了です
        </h1>
        <p className="mb-5 text-sm leading-relaxed text-on-surface-variant">
          {message}
        </p>
        <div className="space-y-3 rounded-lg border border-outline-variant bg-surface-container-low p-4 text-sm">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              管理者向け確認
            </div>
            <p className="text-on-surface">{adminHint}</p>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              Health check
            </div>
            <code className="rounded bg-tertiary-container px-1.5 py-0.5 font-mono text-[12px] text-on-tertiary-container">
              {healthCheckPath}
            </code>
          </div>
        </div>
      </section>
    </main>
  );
}

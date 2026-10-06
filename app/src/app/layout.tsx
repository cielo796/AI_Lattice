import type { Metadata } from "next";
import { DisplayThemeProvider } from "@/components/shared/DisplayThemeProvider";
import { displayThemeBootstrap, resolveDisplayTheme } from "@/lib/display-theme";
import { getInitialDisplaySettings } from "@/server/display/service";
import { AuthBootstrap } from "@/components/shared/AuthBootstrap";
import { ToastViewport } from "@/components/shared/ToastViewport";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Lattice - インテリジェント・レイヤー",
  description:
    "AI駆動型 エンタープライズ・ローコード基盤。AIで業務アプリを構築。",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getInitialDisplaySettings();
  const bootstrap = displayThemeBootstrap(settings);
  return (
    <html lang="ja" data-theme={resolveDisplayTheme(settings)} suppressHydrationWarning>
      <head>
        {bootstrap && <script dangerouslySetInnerHTML={{ __html: bootstrap }} />}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-surface text-on-surface font-body antialiased">
        <DisplayThemeProvider initialSettings={settings}>
          <AuthBootstrap />
          {children}
          <ToastViewport />
        </DisplayThemeProvider>
      </body>
    </html>
  );
}

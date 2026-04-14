import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import { AuthBootstrap } from "@/components/shared/AuthBootstrap";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AI Lattice - インテリジェント・レイヤー",
  description:
    "AI駆動型 エンタープライズ・ローコード基盤。AIで業務アプリを構築。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${manrope.variable} ${inter.variable}`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-surface text-on-surface font-body antialiased">
        <AuthBootstrap />
        {children}
      </body>
    </html>
  );
}

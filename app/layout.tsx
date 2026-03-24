import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "nodeSEO - 逆SEO対策管理ツール",
  description: "検索順位の監視・ネガティブURL対策・コンテンツ発信管理ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 dark:bg-navy-950 text-gray-900 dark:text-white font-sans">
        <ThemeProvider>
          {/* サイドバーナビゲーション */}
          <Sidebar />

          {/* メインコンテンツ（サイドバー分オフセット） */}
          <main className="lg:ml-60 pt-14 lg:pt-0">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}

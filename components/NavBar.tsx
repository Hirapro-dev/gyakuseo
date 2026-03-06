"use client";

import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";

export function NavBar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="bg-navy-900 dark:bg-navy-900 border-b border-navy-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-xl font-bold text-accent-500"
            >
              逆SEO管理
            </Link>
            <div className="hidden sm:flex items-center gap-1">
              <Link
                href="/"
                className="text-sm text-gray-300 hover:text-accent-400 transition-colors px-3 py-2 rounded-md hover:bg-navy-800"
              >
                ダッシュボード
              </Link>
              <Link
                href="/keywords"
                className="text-sm text-gray-300 hover:text-accent-400 transition-colors px-3 py-2 rounded-md hover:bg-navy-800"
              >
                キーワード管理
              </Link>
              <Link
                href="/urls"
                className="text-sm text-gray-300 hover:text-accent-400 transition-colors px-3 py-2 rounded-md hover:bg-navy-800"
              >
                URL管理
              </Link>
              <Link
                href="/settings"
                className="text-sm text-gray-300 hover:text-accent-400 transition-colors px-3 py-2 rounded-md hover:bg-navy-800"
              >
                設定
              </Link>
            </div>
          </div>

          {/* テーマ切り替えボタン */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-400 hover:bg-navy-800 transition-colors"
            title={theme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え"}
          >
            {theme === "dark" ? (
              // 太陽アイコン（ライトモードへ）
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                />
              </svg>
            ) : (
              // 月アイコン（ダークモードへ）
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* モバイルメニュー */}
      <div className="sm:hidden border-t border-navy-700 px-4 py-2 flex gap-2 flex-wrap">
        <Link
          href="/"
          className="text-xs text-gray-300 px-3 py-2 rounded-md hover:bg-navy-800"
        >
          ダッシュボード
        </Link>
        <Link
          href="/keywords"
          className="text-xs text-gray-300 px-3 py-2 rounded-md hover:bg-navy-800"
        >
          キーワード
        </Link>
        <Link
          href="/urls"
          className="text-xs text-gray-300 px-3 py-2 rounded-md hover:bg-navy-800"
        >
          URL
        </Link>
        <Link
          href="/settings"
          className="text-xs text-gray-300 px-3 py-2 rounded-md hover:bg-navy-800"
        >
          設定
        </Link>
      </div>
    </nav>
  );
}

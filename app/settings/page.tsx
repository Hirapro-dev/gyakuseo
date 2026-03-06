"use client";

import { useTheme } from "@/components/ThemeProvider";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          アプリケーションの表示設定
        </p>
      </div>

      {/* 表示設定 */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-navy-700">
          <h2 className="text-lg font-bold">表示設定</h2>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-navy-700">
          {/* ダーク/ライトモード切り替え */}
          <div className="px-6 py-5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                テーマ
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                ダークモードとライトモードを切り替えます
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {theme === "dark" ? "ダーク" : "ライト"}
              </span>
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 dark:focus:ring-offset-navy-900 ${
                  theme === "dark"
                    ? "bg-accent-500"
                    : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    theme === "dark"
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* テーマプレビュー */}
          <div className="px-6 py-5">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              カラープレビュー
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <div className="h-16 rounded-lg bg-navy-950 border border-navy-700"></div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  ダークネイビー
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="h-16 rounded-lg bg-white border border-gray-200"></div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  ホワイト
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="h-16 rounded-lg bg-gray-100 border border-gray-200"></div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  ライトグレイ
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="h-16 rounded-lg bg-accent-500"></div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  アクセント（黄色）
                </p>
              </div>
            </div>
          </div>

          {/* ボタンプレビュー */}
          <div className="px-6 py-5">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              ボタンプレビュー
            </h3>
            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-navy-950 rounded-lg text-sm font-medium transition-colors">
                プライマリボタン
              </button>
              <button className="px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded-lg text-sm font-medium transition-colors">
                セカンダリボタン
              </button>
              <button className="px-4 py-2 border border-gray-300 dark:border-navy-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 rounded-lg text-sm font-medium transition-colors">
                アウトラインボタン
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* アプリケーション情報 */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-navy-700">
          <h2 className="text-lg font-bold">アプリケーション情報</h2>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">アプリ名</span>
            <span className="text-gray-900 dark:text-white">逆SEO対策管理ツール</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">バージョン</span>
            <span className="text-gray-900 dark:text-white">1.0.0</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">検索API</span>
            <span className="text-gray-900 dark:text-white">SerpAPI</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">データベース</span>
            <span className="text-gray-900 dark:text-white">Neon (PostgreSQL)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

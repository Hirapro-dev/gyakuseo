"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Article, Keyword } from "@/lib/schema";

// 記事＋キーワード情報の型
interface ArticleWithKeyword extends Article {
  keyword?: Keyword | null;
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<ArticleWithKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "published">("all");

  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch("/api/articles");
      const data = await res.json();
      setArticles(data);
    } catch (error) {
      console.error("記事一覧取得エラー:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // 記事削除
  const handleDelete = async (id: number) => {
    if (!confirm("この記事を削除しますか？関連するリライト・投稿ログも削除されます。")) return;
    try {
      const res = await fetch(`/api/articles?id=${id}`, { method: "DELETE" });
      if (res.ok) await fetchArticles();
      else alert("削除に失敗しました");
    } catch {
      alert("削除に失敗しました");
    }
  };

  // フィルター適用
  const filteredArticles = articles.filter((a) =>
    filterStatus === "all" ? true : a.status === filterStatus
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">記事管理</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            コンテンツの作成・AIリライト・配信管理
          </p>
        </div>
        <Link
          href="/articles/new"
          className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-navy-950 rounded-lg text-sm font-medium transition-colors"
        >
          新規作成
        </Link>
      </div>

      {/* フィルター */}
      <div className="flex gap-2">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "all" | "draft" | "published")}
          className="px-3 py-1.5 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="all">すべて</option>
          <option value="draft">下書き</option>
          <option value="published">公開</option>
        </select>
      </div>

      {/* 記事一覧 */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-navy-700">
          <h2 className="text-lg font-bold">記事一覧 ({filteredArticles.length}件)</h2>
        </div>

        {filteredArticles.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">記事がありません</p>
            <Link
              href="/articles/new"
              className="inline-block px-4 py-2 bg-accent-500 hover:bg-accent-600 text-navy-950 rounded-lg text-sm font-medium transition-colors"
            >
              最初の記事を作成する
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-navy-700">
            {filteredArticles.map((article) => (
              <div
                key={article.id}
                className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/articles/${article.id}`}
                      className="text-sm font-medium text-gray-900 dark:text-white hover:text-accent-500 transition-colors"
                    >
                      {article.title}
                    </Link>
                    <div className="flex items-center gap-3 mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          article.status === "published"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {article.status === "published" ? "公開" : "下書き"}
                      </span>
                      {article.keyword && (
                        <span className="text-xs text-gray-400">
                          キーワード: {article.keyword.keyword}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(article.createdAt).toLocaleDateString("ja-JP")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Link
                      href={`/articles/${article.id}`}
                      className="text-sm text-accent-500 hover:text-accent-400"
                    >
                      詳細
                    </Link>
                    <button
                      onClick={() => handleDelete(article.id)}
                      className="text-sm text-red-500 hover:text-red-400"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

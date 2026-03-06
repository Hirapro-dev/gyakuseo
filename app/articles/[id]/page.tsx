"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { RewritePanel } from "@/components/RewritePanel";
import { PublishStatusCard } from "@/components/PublishStatusCard";
import type { Article, Keyword, RewrittenArticle, PublishLog } from "@/lib/schema";

// 記事詳細の型
interface ArticleDetail extends Article {
  keyword?: Keyword | null;
  rewrittenArticles: RewrittenArticle[];
  publishLogs: PublishLog[];
}

export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const articleId = params.id as string;

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [rewriting, setRewriting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  // 記事データ取得
  const fetchArticle = useCallback(async () => {
    try {
      const res = await fetch("/api/articles");
      const data: ArticleDetail[] = await res.json();
      const found = data.find((a) => a.id === parseInt(articleId));
      if (found) {
        setArticle(found);
        setEditTitle(found.title);
        setEditBody(found.body);
      }
    } catch (error) {
      console.error("記事取得エラー:", error);
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  // 記事更新
  const handleUpdate = async () => {
    if (!editTitle.trim() || !editBody.trim()) {
      alert("タイトルと本文を入力してください");
      return;
    }

    try {
      const res = await fetch("/api/articles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: parseInt(articleId),
          title: editTitle,
          body: editBody,
        }),
      });

      if (res.ok) {
        setEditing(false);
        await fetchArticle();
      } else {
        const error = await res.json();
        alert(`更新エラー: ${error.error}`);
      }
    } catch {
      alert("更新に失敗しました");
    }
  };

  // AIリライト実行
  const handleRewrite = async () => {
    setRewriting(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/rewrite`, {
        method: "POST",
      });

      if (res.ok) {
        await fetchArticle();
      } else {
        const error = await res.json();
        alert(`リライトエラー: ${error.error}`);
      }
    } catch {
      alert("リライトに失敗しました");
    } finally {
      setRewriting(false);
    }
  };

  // ステータス切り替え
  const toggleStatus = async () => {
    if (!article) return;
    const newStatus = article.status === "draft" ? "published" : "draft";
    try {
      await fetch("/api/articles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: article.id, status: newStatus }),
      });
      await fetchArticle();
    } catch {
      alert("ステータス変更に失敗しました");
    }
  };

  // 記事削除
  const handleDelete = async () => {
    if (!confirm("この記事を削除しますか？")) return;
    try {
      await fetch(`/api/articles?id=${articleId}`, { method: "DELETE" });
      router.push("/articles");
    } catch {
      alert("削除に失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">読み込み中...</div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">記事が見つかりません</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{article.title}</h1>
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
              作成: {new Date(article.createdAt).toLocaleDateString("ja-JP")}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleStatus}
            className="px-3 py-1.5 border border-gray-300 dark:border-navy-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 rounded-lg text-xs font-medium transition-colors"
          >
            {article.status === "draft" ? "公開にする" : "下書きに戻す"}
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className="px-3 py-1.5 border border-gray-300 dark:border-navy-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 rounded-lg text-xs font-medium transition-colors"
          >
            {editing ? "キャンセル" : "編集"}
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-xs font-medium transition-colors"
          >
            削除
          </button>
        </div>
      </div>

      {/* 記事本文（表示/編集モード） */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 p-6">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">タイトル</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">本文</label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={12}
                className="w-full px-4 py-3 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500 resize-y"
              />
              <p className="text-xs text-gray-400 mt-1">{editBody.length}文字</p>
            </div>
            <button
              onClick={handleUpdate}
              className="px-6 py-2 bg-accent-500 hover:bg-accent-600 text-navy-950 rounded-lg text-sm font-medium transition-colors"
            >
              保存
            </button>
          </div>
        ) : (
          <div>
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
              記事本文
            </h3>
            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
              {article.body}
            </div>
            <p className="text-xs text-gray-400 mt-3">{article.body.length}文字</p>
          </div>
        )}
      </div>

      {/* AIリライトセクション */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-navy-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">AIリライト</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              6プラットフォーム向けに自動リライト
            </p>
          </div>
          <button
            onClick={handleRewrite}
            disabled={rewriting}
            className="px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-navy-950 rounded-lg text-sm font-medium transition-colors"
          >
            {rewriting ? "リライト中..." : "AIリライト実行"}
          </button>
        </div>

        {article.rewrittenArticles.length > 0 ? (
          <RewritePanel
            rewrittenArticles={article.rewrittenArticles}
            articleId={article.id}
            onPublished={fetchArticle}
          />
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              「AIリライト実行」ボタンを押して、各プラットフォーム向けの記事を生成してください
            </p>
          </div>
        )}
      </div>

      {/* 投稿ログ */}
      {article.publishLogs.length > 0 && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-navy-700">
            <h2 className="text-lg font-bold">投稿ログ</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-navy-700">
            {article.publishLogs
              .sort(
                (a, b) =>
                  new Date(b.publishedAt).getTime() -
                  new Date(a.publishedAt).getTime()
              )
              .map((log) => (
                <PublishStatusCard key={log.id} log={log} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

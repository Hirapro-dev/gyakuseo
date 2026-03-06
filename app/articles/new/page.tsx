"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Keyword } from "@/lib/schema";

export default function NewArticlePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [keywordId, setKeywordId] = useState<number | "">("");
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // キーワード一覧取得
  useEffect(() => {
    fetch("/api/keywords")
      .then((res) => res.json())
      .then(setKeywords)
      .catch(console.error);
  }, []);

  // 記事保存
  const handleSave = async (status: "draft" | "published") => {
    if (!title.trim() || !body.trim()) {
      alert("タイトルと本文を入力してください");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          keywordId: keywordId || null,
          status,
        }),
      });

      if (res.ok) {
        const article = await res.json();
        router.push(`/articles/${article.id}`);
      } else {
        const error = await res.json();
        alert(`保存エラー: ${error.error}`);
      }
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold">記事を作成</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          新しいコンテンツを作成してAIリライト・配信に活用
        </p>
      </div>

      {/* 記事作成フォーム */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 p-6 space-y-5">
        {/* タイトル */}
        <div>
          <label className="block text-sm font-medium mb-1.5">タイトル</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="記事タイトルを入力"
            className="w-full px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>

        {/* 関連キーワード */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            関連キーワード（任意）
          </label>
          <select
            value={keywordId}
            onChange={(e) =>
              setKeywordId(e.target.value ? parseInt(e.target.value) : "")
            }
            className="w-full px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            <option value="">キーワードを選択（任意）</option>
            {keywords.map((kw) => (
              <option key={kw.id} value={kw.id}>
                {kw.keyword}
              </option>
            ))}
          </select>
        </div>

        {/* 本文 */}
        <div>
          <label className="block text-sm font-medium mb-1.5">本文</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="記事の本文を入力..."
            rows={15}
            className="w-full px-4 py-3 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500 resize-y"
          />
          <p className="text-xs text-gray-400 mt-1">
            {body.length}文字
          </p>
        </div>

        {/* アクションボタン */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => handleSave("draft")}
            disabled={submitting}
            className="px-6 py-2 border border-gray-300 dark:border-navy-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? "保存中..." : "下書き保存"}
          </button>
          <button
            onClick={() => handleSave("published")}
            disabled={submitting}
            className="px-6 py-2 bg-accent-500 hover:bg-accent-600 text-navy-950 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? "保存中..." : "公開として保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

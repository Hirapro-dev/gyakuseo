"use client";

import { useState, useEffect, useCallback } from "react";
import { KeywordTable } from "@/components/KeywordTable";
import type { Keyword } from "@/lib/schema";

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [newMemo, setNewMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // キーワード一覧取得
  const fetchKeywords = useCallback(async () => {
    try {
      const res = await fetch("/api/keywords");
      const data = await res.json();
      setKeywords(data);
    } catch (error) {
      console.error("キーワード取得エラー:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  // キーワード追加
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: newKeyword,
          memo: newMemo || null,
          isActive: true,
        }),
      });

      if (res.ok) {
        setNewKeyword("");
        setNewMemo("");
        await fetchKeywords();
      } else {
        const error = await res.json();
        alert(`追加エラー: ${error.error}`);
      }
    } catch (error) {
      console.error("キーワード追加エラー:", error);
      alert("キーワードの追加に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  // キーワード更新
  const handleUpdate = async (id: number, data: Partial<Keyword>) => {
    try {
      const res = await fetch("/api/keywords", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });

      if (res.ok) {
        await fetchKeywords();
      } else {
        const error = await res.json();
        alert(`更新エラー: ${error.error}`);
      }
    } catch (error) {
      console.error("キーワード更新エラー:", error);
    }
  };

  // キーワード削除
  const handleDelete = async (id: number) => {
    if (!confirm("このキーワードを削除しますか？関連するURLと順位履歴も削除されます。")) {
      return;
    }

    try {
      const res = await fetch(`/api/keywords?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchKeywords();
      } else {
        const error = await res.json();
        alert(`削除エラー: ${error.error}`);
      }
    } catch (error) {
      console.error("キーワード削除エラー:", error);
    }
  };

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
      <div>
        <h1 className="text-2xl font-bold">キーワード管理</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          監視するキーワードの追加・編集・削除
        </p>
      </div>

      {/* キーワード追加フォーム */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 p-6">
        <h2 className="text-lg font-bold mb-4">キーワードを追加</h2>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="監視キーワードを入力"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
            required
          />
          <input
            type="text"
            value={newMemo}
            onChange={(e) => setNewMemo(e.target.value)}
            placeholder="メモ（任意）"
            className="sm:w-48 px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-navy-950 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            {submitting ? "追加中..." : "追加"}
          </button>
        </form>
      </div>

      {/* キーワード一覧テーブル */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-navy-700">
          <h2 className="text-lg font-bold">
            登録済みキーワード ({keywords.length}件)
          </h2>
        </div>
        <KeywordTable
          keywords={keywords}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}

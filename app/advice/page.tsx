"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Keyword, SuggestAdvice } from "@/lib/schema";

// ステータス表示設定
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  todo: { label: "未着手", color: "text-gray-400", bg: "bg-gray-500/20" },
  in_progress: { label: "対応中", color: "text-yellow-400", bg: "bg-yellow-500/20" },
  done: { label: "完了", color: "text-green-400", bg: "bg-green-500/20" },
};
const STATUS_OPTIONS = ["todo", "in_progress", "done"] as const;

// 優先度表示設定
const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "高", color: "text-red-400", bg: "bg-red-500/20" },
  medium: { label: "中", color: "text-yellow-400", bg: "bg-yellow-500/20" },
  low: { label: "低", color: "text-blue-400", bg: "bg-blue-500/20" },
};
const PRIORITY_OPTIONS = ["high", "medium", "low"] as const;

export default function AdvicePage() {
  const [allKeywords, setAllKeywords] = useState<Keyword[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<number | "all">("all");
  const [adviceList, setAdviceList] = useState<(SuggestAdvice & { keyword?: Keyword })[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // フォーム
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    keywordId: 0,
    suggestText: "",
    advice: "",
    priority: "medium" as "high" | "medium" | "low",
  });
  const [submitting, setSubmitting] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  // フィルター・ソート
  const [statusFilter, setStatusFilter] = useState<"all" | "todo" | "in_progress" | "done">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [sortKey, setSortKey] = useState<"createdAt" | "priority" | "status">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // キーワード一覧取得
  const fetchKeywords = useCallback(async () => {
    try {
      const res = await fetch("/api/keywords");
      if (res.ok) {
        setAllKeywords(await res.json());
      }
    } catch (error) {
      console.error("キーワード取得エラー:", error);
    }
  }, []);

  // 対策アドバイス取得（全キーワード or 個別）
  const fetchAdvice = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedKeywordId !== "all") {
        params.set("keywordId", String(selectedKeywordId));
      }
      const res = await fetch(`/api/suggest-advice?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAdviceList(data);
      }
    } catch (error) {
      console.error("対策アドバイス取得エラー:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedKeywordId]);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  useEffect(() => {
    fetchAdvice();
  }, [fetchAdvice]);

  // AI生成
  const handleGenerateAI = async () => {
    if (selectedKeywordId === "all") {
      setMessage("AIアドバイス生成にはキーワードを選択してください");
      return;
    }
    setGeneratingAI(true);
    setMessage("");
    try {
      const res = await fetch("/api/suggest-advice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywordId: selectedKeywordId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        await fetchAdvice();
      } else {
        setMessage(`エラー: ${data.error}`);
      }
    } catch {
      setMessage("AI対策アドバイスの生成に失敗しました");
    } finally {
      setGeneratingAI(false);
    }
  };

  // 保存（追加/更新）
  const handleSave = async () => {
    if (!formData.advice.trim()) return;
    if (!editingId && formData.keywordId === 0) {
      setMessage("キーワードを選択してください");
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        const res = await fetch("/api/suggest-advice", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            advice: formData.advice,
            priority: formData.priority,
          }),
        });
        if (res.ok) {
          await fetchAdvice();
          resetForm();
        }
      } else {
        const res = await fetch("/api/suggest-advice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keywordId: formData.keywordId,
            suggestText: formData.suggestText || null,
            advice: formData.advice,
            priority: formData.priority,
          }),
        });
        if (res.ok) {
          await fetchAdvice();
          resetForm();
        }
      }
    } catch (error) {
      console.error("保存エラー:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // ステータス変更
  const handleStatusChange = async (id: number, status: string) => {
    try {
      const res = await fetch("/api/suggest-advice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setAdviceList((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: status as SuggestAdvice["status"] } : a))
        );
      }
    } catch (error) {
      console.error("ステータス更新エラー:", error);
    }
  };

  // 削除
  const handleDelete = async (id: number) => {
    if (!confirm("この対策メモを削除しますか？")) return;
    try {
      const res = await fetch(`/api/suggest-advice?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setAdviceList((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (error) {
      console.error("削除エラー:", error);
    }
  };

  // 編集開始
  const startEdit = (advice: SuggestAdvice) => {
    setEditingId(advice.id);
    setFormData({
      keywordId: advice.keywordId,
      suggestText: advice.suggestText || "",
      advice: advice.advice,
      priority: advice.priority as "high" | "medium" | "low",
    });
    setShowForm(true);
  };

  // フォームリセット
  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ keywordId: 0, suggestText: "", advice: "", priority: "medium" });
  };

  // フィルター+ソート
  const filteredAdvice = useMemo(() => {
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const statusOrder: Record<string, number> = { todo: 0, in_progress: 1, done: 2 };

    let result = adviceList;

    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (priorityFilter !== "all") {
      result = result.filter((a) => a.priority === priorityFilter);
    }

    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "priority":
          cmp = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
          break;
        case "status":
          cmp = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [adviceList, statusFilter, priorityFilter, sortKey, sortDir]);

  // ステータス別集計
  const statusCounts = adviceList.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // キーワード名取得
  const getKeywordName = (keywordId: number) => {
    return allKeywords.find((k) => k.id === keywordId)?.keyword || `KW#${keywordId}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">対策アドバイス</h1>
          <p className="text-sm text-muted mt-1">
            AI分析による対策施策の管理
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateAI}
            disabled={generatingAI || selectedKeywordId === "all"}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors font-medium text-sm disabled:opacity-50 flex items-center gap-2"
          >
            {generatingAI ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            )}
            {generatingAI ? "AI生成中..." : "AIアドバイス生成"}
          </button>
          <button
            onClick={() => {
              resetForm();
              setFormData((prev) => ({
                ...prev,
                keywordId: selectedKeywordId !== "all" ? (selectedKeywordId as number) : 0,
              }));
              setShowForm(true);
            }}
            className="px-4 py-2 bg-accent-500 text-navy-900 rounded-lg hover:bg-accent-400 transition-colors font-medium text-sm flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            手動追加
          </button>
        </div>
      </div>

      {/* メッセージ */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.startsWith("エラー") ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"}`}>
          {message}
          <button onClick={() => setMessage("")} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* キーワード絞り込み */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-muted mb-1">キーワード絞り込み</label>
            <select
              value={selectedKeywordId === "all" ? "all" : String(selectedKeywordId)}
              onChange={(e) =>
                setSelectedKeywordId(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              className="w-full px-3 py-2 rounded-lg border border-navy-600 bg-navy-800 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              <option value="all">全キーワード</option>
              {allKeywords.map((kw) => (
                <option key={kw.id} value={kw.id}>{kw.keyword}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ステータス別サマリー */}
      {adviceList.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {STATUS_OPTIONS.map((s) => {
            const config = STATUS_CONFIG[s];
            const count = statusCounts[s] || 0;
            return (
              <div key={s} className={`card p-3 ${config.bg} border-none`}>
                <div className={`text-xs font-medium ${config.color}`}>{config.label}</div>
                <div className={`text-2xl font-bold ${config.color}`}>{count}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* 追加/編集フォーム */}
      {showForm && (
        <div className="card p-4 border-accent-500/50">
          <h3 className="text-sm font-bold text-foreground mb-3">
            {editingId ? "対策メモを編集" : "対策メモを追加"}
          </h3>
          <div className="space-y-3">
            {/* キーワード選択（新規時のみ） */}
            {!editingId && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1">キーワード</label>
                <select
                  value={formData.keywordId || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, keywordId: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-lg border border-navy-600 bg-navy-800 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  <option value="">キーワードを選択</option>
                  {allKeywords.map((kw) => (
                    <option key={kw.id} value={kw.id}>{kw.keyword}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 対象サジェスト */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1">対象サジェスト（任意）</label>
              <input
                type="text"
                value={formData.suggestText}
                onChange={(e) => setFormData((prev) => ({ ...prev, suggestText: e.target.value }))}
                placeholder="特定のサジェストに紐付ける場合に入力"
                className="w-full px-3 py-2 rounded-lg border border-navy-600 bg-navy-800 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 placeholder-gray-500"
              />
            </div>

            {/* 対策内容 */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1">対策内容・施策メモ</label>
              <textarea
                value={formData.advice}
                onChange={(e) => setFormData((prev) => ({ ...prev, advice: e.target.value }))}
                placeholder="具体的な対策内容を記載..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-navy-600 bg-navy-800 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 resize-y placeholder-gray-500"
              />
            </div>

            {/* 優先度 */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1">優先度</label>
              <div className="flex gap-2">
                {PRIORITY_OPTIONS.map((p) => {
                  const config = PRIORITY_CONFIG[p];
                  const isSelected = formData.priority === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setFormData((prev) => ({ ...prev, priority: p }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isSelected
                          ? `${config.bg} ${config.color} ring-2 ring-current`
                          : "bg-navy-700 text-muted hover:bg-navy-600"
                      }`}
                    >
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ボタン */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={submitting || !formData.advice.trim()}
                className="px-4 py-2 bg-accent-500 text-navy-900 rounded-lg hover:bg-accent-400 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {submitting ? "保存中..." : editingId ? "更新" : "追加"}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-navy-700 text-foreground rounded-lg hover:bg-navy-600 transition-colors text-sm border border-navy-600"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* フィルター・ソートバー */}
      {adviceList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted mr-1">フィルター:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-navy-700 text-gray-300 border border-navy-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            <option value="all">全ステータス</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label} ({statusCounts[s] || 0})</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-navy-700 text-gray-300 border border-navy-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            <option value="all">全優先度</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
            ))}
          </select>

          <div className="w-px h-5 bg-navy-700 mx-1" />

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-navy-700 text-gray-300 border border-navy-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            <option value="createdAt">作成日順</option>
            <option value="priority">優先度順</option>
            <option value="status">ステータス順</option>
          </select>
          <button
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-navy-700 text-gray-300 border border-navy-600 hover:bg-navy-600 transition-colors"
          >
            {sortDir === "asc" ? "▲" : "▼"}
          </button>
        </div>
      )}

      {/* 対策アドバイス一覧 */}
      <div className="space-y-3">
        {filteredAdvice.length === 0 ? (
          <div className="card p-8 text-center text-muted">
            対策メモがありません。「AIアドバイス生成」または「手動追加」から作成してください。
          </div>
        ) : (
          filteredAdvice.map((advice) => {
            const statusConfig = STATUS_CONFIG[advice.status];
            const priorityConfig = PRIORITY_CONFIG[advice.priority];
            return (
              <div key={advice.id} className="card p-4 hover:bg-navy-800/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* キーワード表示 */}
                    <div className="text-xs text-accent-400 font-medium mb-1">
                      {getKeywordName(advice.keywordId)}
                    </div>
                    {/* 対象サジェスト */}
                    {advice.suggestText && (
                      <div className="text-xs text-muted mb-1 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                        </svg>
                        対象: {advice.suggestText}
                      </div>
                    )}
                    <p className="text-sm text-foreground whitespace-pre-wrap">{advice.advice}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${priorityConfig.bg} ${priorityConfig.color}`}>
                        優先度: {priorityConfig.label}
                      </span>
                      <span className="text-xs text-muted">
                        {new Date(advice.createdAt).toLocaleDateString("ja-JP")}
                      </span>
                    </div>
                  </div>

                  {/* 右側コントロール */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={advice.status}
                      onChange={(e) => handleStatusChange(advice.id, e.target.value)}
                      className={`px-2 py-1 rounded text-xs font-medium border-none focus:outline-none focus:ring-2 focus:ring-accent-500 cursor-pointer ${statusConfig.bg} ${statusConfig.color}`}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{STATUS_CONFIG[opt].label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => startEdit(advice)}
                      className="p-1.5 rounded hover:bg-navy-700 transition-colors text-muted hover:text-foreground"
                      title="編集"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(advice.id)}
                      className="p-1.5 rounded hover:bg-red-500/20 transition-colors text-muted hover:text-red-400"
                      title="削除"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

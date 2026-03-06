"use client";

import { useState, useEffect, useCallback } from "react";
import type { Keyword, SuggestHistory, SuggestAdvice } from "@/lib/schema";

// sentiment表示設定
const SENTIMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  negative: { label: "ネガティブ", color: "text-red-400", bg: "bg-red-500/20" },
  neutral: { label: "ニュートラル", color: "text-blue-400", bg: "bg-blue-500/20" },
  positive: { label: "ポジティブ", color: "text-green-400", bg: "bg-green-500/20" },
  unclassified: { label: "未分類", color: "text-gray-400", bg: "bg-gray-500/20" },
};

const SENTIMENT_OPTIONS = ["negative", "neutral", "positive", "unclassified"] as const;

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

export default function SuggestsPage() {
  const [allKeywords, setAllKeywords] = useState<Keyword[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<number | null>(null);
  const [suggests, setSuggests] = useState<SuggestHistory[]>([]);
  const [adviceList, setAdviceList] = useState<SuggestAdvice[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().split("T")[0];
  });
  const [message, setMessage] = useState("");

  // 対策アドバイスフォーム
  const [showAdviceForm, setShowAdviceForm] = useState(false);
  const [adviceFormData, setAdviceFormData] = useState({
    suggestText: "",
    advice: "",
    priority: "medium" as "high" | "medium" | "low",
  });
  const [editingAdviceId, setEditingAdviceId] = useState<number | null>(null);
  const [submittingAdvice, setSubmittingAdvice] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  // キーワード一覧取得
  const fetchKeywords = useCallback(async () => {
    try {
      const res = await fetch("/api/keywords");
      if (res.ok) {
        const data = await res.json();
        setAllKeywords(data);
        if (data.length > 0 && !selectedKeywordId) {
          setSelectedKeywordId(data[0].id);
        }
      }
    } catch (error) {
      console.error("キーワード取得エラー:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedKeywordId]);

  // サジェスト履歴取得
  const fetchSuggests = useCallback(async () => {
    if (!selectedKeywordId) return;
    try {
      const params = new URLSearchParams({
        keywordId: String(selectedKeywordId),
        date: selectedDate,
      });
      const res = await fetch(`/api/suggests?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSuggests(data);
      }
    } catch (error) {
      console.error("サジェスト履歴取得エラー:", error);
    }
  }, [selectedKeywordId, selectedDate]);

  // 対策アドバイス取得
  const fetchAdvice = useCallback(async () => {
    if (!selectedKeywordId) return;
    try {
      const params = new URLSearchParams({
        keywordId: String(selectedKeywordId),
      });
      const res = await fetch(`/api/suggest-advice?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAdviceList(data);
      }
    } catch (error) {
      console.error("対策アドバイス取得エラー:", error);
    }
  }, [selectedKeywordId]);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  useEffect(() => {
    if (selectedKeywordId) {
      fetchSuggests();
      fetchAdvice();
    }
  }, [selectedKeywordId, selectedDate, fetchSuggests, fetchAdvice]);

  // サジェスト取得実行
  const handleFetchSuggests = async () => {
    if (!selectedKeywordId) return;
    setFetching(true);
    setMessage("");
    try {
      const res = await fetch("/api/suggests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywordId: selectedKeywordId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        await fetchSuggests();
      } else {
        setMessage(`エラー: ${data.error}`);
      }
    } catch (error) {
      setMessage("サジェスト取得に失敗しました");
      console.error(error);
    } finally {
      setFetching(false);
    }
  };

  // 全キーワード一括取得
  const handleFetchAll = async () => {
    setFetching(true);
    setMessage("");
    try {
      const res = await fetch("/api/suggests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        await fetchSuggests();
      } else {
        setMessage(`エラー: ${data.error}`);
      }
    } catch (error) {
      setMessage("サジェスト取得に失敗しました");
      console.error(error);
    } finally {
      setFetching(false);
    }
  };

  // sentiment更新
  const handleSentimentChange = async (id: number, sentiment: string) => {
    try {
      const res = await fetch("/api/suggests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, sentiment }),
      });
      if (res.ok) {
        setSuggests((prev) =>
          prev.map((s) => (s.id === id ? { ...s, sentiment: sentiment as SuggestHistory["sentiment"] } : s))
        );
      }
    } catch (error) {
      console.error("sentiment更新エラー:", error);
    }
  };

  // 日付変更
  const changeDate = (offset: number) => {
    const current = new Date(selectedDate + "T00:00:00+09:00");
    current.setDate(current.getDate() + offset);
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    setSelectedDate(`${year}-${month}-${day}`);
  };

  // 対策アドバイス追加/更新
  const handleSaveAdvice = async () => {
    if (!selectedKeywordId || !adviceFormData.advice.trim()) return;
    setSubmittingAdvice(true);
    try {
      if (editingAdviceId) {
        // 更新
        const res = await fetch("/api/suggest-advice", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingAdviceId,
            advice: adviceFormData.advice,
            priority: adviceFormData.priority,
          }),
        });
        if (res.ok) {
          await fetchAdvice();
          resetAdviceForm();
        }
      } else {
        // 新規追加
        const res = await fetch("/api/suggest-advice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keywordId: selectedKeywordId,
            suggestText: adviceFormData.suggestText || null,
            advice: adviceFormData.advice,
            priority: adviceFormData.priority,
          }),
        });
        if (res.ok) {
          await fetchAdvice();
          resetAdviceForm();
        }
      }
    } catch (error) {
      console.error("対策アドバイス保存エラー:", error);
    } finally {
      setSubmittingAdvice(false);
    }
  };

  // 対策アドバイスステータス変更
  const handleAdviceStatusChange = async (id: number, status: string) => {
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

  // 対策アドバイス削除
  const handleDeleteAdvice = async (id: number) => {
    if (!confirm("この対策メモを削除しますか？")) return;
    try {
      const res = await fetch(`/api/suggest-advice?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setAdviceList((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (error) {
      console.error("対策アドバイス削除エラー:", error);
    }
  };

  // 編集開始
  const startEditAdvice = (advice: SuggestAdvice) => {
    setEditingAdviceId(advice.id);
    setAdviceFormData({
      suggestText: advice.suggestText || "",
      advice: advice.advice,
      priority: advice.priority as "high" | "medium" | "low",
    });
    setShowAdviceForm(true);
  };

  // サジェストテキストから対策メモ作成
  const startAdviceFromSuggest = (suggestText: string) => {
    setEditingAdviceId(null);
    setAdviceFormData({
      suggestText,
      advice: "",
      priority: "medium",
    });
    setShowAdviceForm(true);
  };

  // フォームリセット
  const resetAdviceForm = () => {
    setShowAdviceForm(false);
    setEditingAdviceId(null);
    setAdviceFormData({ suggestText: "", advice: "", priority: "medium" });
  };

  // AIアドバイス生成
  const handleGenerateAI = async () => {
    if (!selectedKeywordId) return;
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
    } catch (error) {
      setMessage("AI対策アドバイスの生成に失敗しました");
      console.error(error);
    } finally {
      setGeneratingAI(false);
    }
  };

  // sentiment別の集計
  const sentimentCounts = suggests.reduce(
    (acc, s) => {
      acc[s.sentiment] = (acc[s.sentiment] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // 対策アドバイスのステータス別集計
  const adviceStatusCounts = adviceList.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

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
          <h1 className="text-2xl font-bold text-foreground">サジェスト対策</h1>
          <p className="text-sm text-muted mt-1">
            Googleサジェスト（オートコンプリート）の監視・分類・対策管理
          </p>
        </div>
        <button
          onClick={handleFetchAll}
          disabled={fetching}
          className="px-4 py-2 bg-accent-500 text-navy-900 rounded-lg hover:bg-accent-400 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {fetching && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-navy-900" />
          )}
          全キーワード一括取得
        </button>
      </div>

      {/* メッセージ */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.startsWith("エラー") ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"}`}>
          {message}
        </div>
      )}

      {/* コントロールパネル */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          {/* キーワード選択 */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-muted mb-1">
              キーワード
            </label>
            <select
              value={selectedKeywordId || ""}
              onChange={(e) => setSelectedKeywordId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-navy-600 bg-navy-800 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              <option value="">キーワードを選択</option>
              {allKeywords.map((kw) => (
                <option key={kw.id} value={kw.id}>
                  {kw.keyword}
                </option>
              ))}
            </select>
          </div>

          {/* 日付選択 */}
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              日付
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeDate(-1)}
                className="px-2 py-2 rounded-lg border border-navy-600 bg-navy-800 text-foreground hover:bg-navy-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-navy-600 bg-navy-800 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
              <button
                onClick={() => changeDate(1)}
                className="px-2 py-2 rounded-lg border border-navy-600 bg-navy-800 text-foreground hover:bg-navy-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>

          {/* 個別取得ボタン */}
          <button
            onClick={handleFetchSuggests}
            disabled={fetching || !selectedKeywordId}
            className="px-4 py-2 bg-navy-700 text-foreground rounded-lg hover:bg-navy-600 transition-colors font-medium disabled:opacity-50 flex items-center gap-2 border border-navy-600"
          >
            {fetching && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-foreground" />
            )}
            サジェスト取得
          </button>
        </div>
      </div>

      {/* サマリー */}
      {suggests.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SENTIMENT_OPTIONS.map((s) => {
            const config = SENTIMENT_CONFIG[s];
            const count = sentimentCounts[s] || 0;
            return (
              <div key={s} className={`card p-3 ${config.bg} border-none`}>
                <div className={`text-xs font-medium ${config.color}`}>{config.label}</div>
                <div className={`text-2xl font-bold ${config.color}`}>{count}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* サジェスト一覧テーブル */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-700">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-12">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  サジェストテキスト
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-40">
                  分類
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-24">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700">
              {suggests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    {selectedKeywordId
                      ? "この日付のサジェストデータがありません。「サジェスト取得」ボタンで取得してください。"
                      : "キーワードを選択してください"}
                  </td>
                </tr>
              ) : (
                suggests.map((s) => {
                  const config = SENTIMENT_CONFIG[s.sentiment];
                  return (
                    <tr key={s.id} className="hover:bg-navy-800/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-muted">
                        {s.position + 1}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground font-medium">
                        {s.suggestText}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={s.sentiment}
                          onChange={(e) => handleSentimentChange(s.id, e.target.value)}
                          className={`px-2 py-1 rounded text-xs font-medium border-none focus:outline-none focus:ring-2 focus:ring-accent-500 cursor-pointer ${config.bg} ${config.color}`}
                        >
                          {SENTIMENT_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {SENTIMENT_CONFIG[opt].label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => startAdviceFromSuggest(s.suggestText)}
                          className="text-xs px-2 py-1 rounded bg-accent-500/20 text-accent-400 hover:bg-accent-500/30 transition-colors"
                          title="このサジェストに対する対策メモを作成"
                        >
                          対策追加
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 取得日時の表示 */}
      {suggests.length > 0 && (
        <div className="text-xs text-muted text-right">
          取得日時: {new Date(suggests[0].checkedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
          {" | "}
          {suggests.length}件のサジェスト
        </div>
      )}

      {/* ===== 対策アドバイスセクション ===== */}
      <div className="border-t border-navy-700 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">対策アドバイス</h2>
            <p className="text-sm text-muted mt-1">
              ポジティブなサジェストを押し上げるための施策メモ管理
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGenerateAI}
              disabled={!selectedKeywordId || generatingAI || suggests.length === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {generatingAI ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              )}
              {generatingAI ? "AI生成中..." : "AIアドバイス生成"}
            </button>
            <button
              onClick={() => {
                setEditingAdviceId(null);
                setAdviceFormData({ suggestText: "", advice: "", priority: "medium" });
                setShowAdviceForm(true);
              }}
              disabled={!selectedKeywordId}
              className="px-4 py-2 bg-accent-500 text-navy-900 rounded-lg hover:bg-accent-400 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              手動追加
            </button>
          </div>
        </div>

        {/* ステータス別サマリー */}
        {adviceList.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {STATUS_OPTIONS.map((s) => {
              const config = STATUS_CONFIG[s];
              const count = adviceStatusCounts[s] || 0;
              return (
                <div key={s} className={`card p-3 ${config.bg} border-none`}>
                  <div className={`text-xs font-medium ${config.color}`}>{config.label}</div>
                  <div className={`text-2xl font-bold ${config.color}`}>{count}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* 対策メモ追加/編集フォーム */}
        {showAdviceForm && (
          <div className="card p-4 mb-4 border-accent-500/50">
            <h3 className="text-sm font-bold text-foreground mb-3">
              {editingAdviceId ? "対策メモを編集" : "対策メモを追加"}
            </h3>
            <div className="space-y-3">
              {/* 対象サジェスト */}
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  対象サジェスト（任意）
                </label>
                <select
                  value={adviceFormData.suggestText}
                  onChange={(e) => setAdviceFormData((prev) => ({ ...prev, suggestText: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-navy-600 bg-navy-800 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  <option value="">全体向け（特定のサジェストに紐付けない）</option>
                  {suggests.map((s) => (
                    <option key={s.id} value={s.suggestText}>
                      {s.suggestText}
                    </option>
                  ))}
                </select>
              </div>

              {/* 対策内容 */}
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  対策内容・施策メモ
                </label>
                <textarea
                  value={adviceFormData.advice}
                  onChange={(e) => setAdviceFormData((prev) => ({ ...prev, advice: e.target.value }))}
                  placeholder="例: ポジティブな口コミを増やすためにGoogleマイビジネスのレビュー促進キャンペーンを実施する"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-navy-600 bg-navy-800 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 resize-y placeholder-gray-500"
                />
              </div>

              {/* 優先度 */}
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  優先度
                </label>
                <div className="flex gap-2">
                  {PRIORITY_OPTIONS.map((p) => {
                    const config = PRIORITY_CONFIG[p];
                    const isSelected = adviceFormData.priority === p;
                    return (
                      <button
                        key={p}
                        onClick={() => setAdviceFormData((prev) => ({ ...prev, priority: p }))}
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
                  onClick={handleSaveAdvice}
                  disabled={submittingAdvice || !adviceFormData.advice.trim()}
                  className="px-4 py-2 bg-accent-500 text-navy-900 rounded-lg hover:bg-accent-400 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {submittingAdvice ? "保存中..." : editingAdviceId ? "更新" : "追加"}
                </button>
                <button
                  onClick={resetAdviceForm}
                  className="px-4 py-2 bg-navy-700 text-foreground rounded-lg hover:bg-navy-600 transition-colors text-sm border border-navy-600"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 対策アドバイス一覧 */}
        <div className="space-y-3">
          {adviceList.length === 0 ? (
            <div className="card p-6 text-center text-muted">
              {selectedKeywordId
                ? "対策メモがありません。「対策メモ追加」ボタンまたはサジェスト一覧の「対策追加」から作成できます。"
                : "キーワードを選択してください"}
            </div>
          ) : (
            adviceList.map((advice) => {
              const statusConfig = STATUS_CONFIG[advice.status];
              const priorityConfig = PRIORITY_CONFIG[advice.priority];
              return (
                <div key={advice.id} className="card p-4 hover:bg-navy-800/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    {/* メイン内容 */}
                    <div className="flex-1 min-w-0">
                      {/* 対象サジェスト表示 */}
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
                        {/* 優先度バッジ */}
                        <span className={`text-xs px-2 py-0.5 rounded ${priorityConfig.bg} ${priorityConfig.color}`}>
                          優先度: {priorityConfig.label}
                        </span>
                        {/* 日時 */}
                        <span className="text-xs text-muted">
                          {new Date(advice.createdAt).toLocaleDateString("ja-JP")}
                        </span>
                      </div>
                    </div>

                    {/* 右側コントロール */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* ステータス切替 */}
                      <select
                        value={advice.status}
                        onChange={(e) => handleAdviceStatusChange(advice.id, e.target.value)}
                        className={`px-2 py-1 rounded text-xs font-medium border-none focus:outline-none focus:ring-2 focus:ring-accent-500 cursor-pointer ${statusConfig.bg} ${statusConfig.color}`}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {STATUS_CONFIG[opt].label}
                          </option>
                        ))}
                      </select>
                      {/* 編集ボタン */}
                      <button
                        onClick={() => startEditAdvice(advice)}
                        className="p-1.5 rounded hover:bg-navy-700 transition-colors text-muted hover:text-foreground"
                        title="編集"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      {/* 削除ボタン */}
                      <button
                        onClick={() => handleDeleteAdvice(advice.id)}
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
    </div>
  );
}

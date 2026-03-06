"use client";

import { useState, useEffect, useCallback } from "react";
import type { Keyword, SuggestHistory } from "@/lib/schema";

// sentiment表示設定
const SENTIMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  negative: { label: "ネガティブ", color: "text-red-400", bg: "bg-red-500/20" },
  neutral: { label: "ニュートラル", color: "text-blue-400", bg: "bg-blue-500/20" },
  positive: { label: "ポジティブ", color: "text-green-400", bg: "bg-green-500/20" },
  unclassified: { label: "未分類", color: "text-gray-400", bg: "bg-gray-500/20" },
};

const SENTIMENT_OPTIONS = ["negative", "neutral", "positive", "unclassified"] as const;

export default function SuggestsPage() {
  const [allKeywords, setAllKeywords] = useState<Keyword[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<number | null>(null);
  const [suggests, setSuggests] = useState<SuggestHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    // 本日のJST日付をYYYY-MM-DD形式で取得
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().split("T")[0];
  });
  const [message, setMessage] = useState("");

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

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  useEffect(() => {
    if (selectedKeywordId) {
      fetchSuggests();
    }
  }, [selectedKeywordId, selectedDate, fetchSuggests]);

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
        // 取得後に再読み込み
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

  // sentiment別の集計
  const sentimentCounts = suggests.reduce(
    (acc, s) => {
      acc[s.sentiment] = (acc[s.sentiment] || 0) + 1;
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
            Googleサジェスト（オートコンプリート）の監視・分類管理
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
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700">
              {suggests.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted">
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
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RankBadge } from "@/components/UrlStatusBadge";
import type { Keyword, SuggestHistory } from "@/lib/schema";

// sentiment表示設定
const SENTIMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  negative: { label: "ネガティブ", color: "text-red-400", bg: "bg-red-500/20" },
  neutral: { label: "ニュートラル", color: "text-blue-400", bg: "bg-blue-500/20" },
  positive: { label: "ポジティブ", color: "text-green-400", bg: "bg-green-500/20" },
  unclassified: { label: "未分類", color: "text-gray-400", bg: "bg-gray-500/20" },
};

const SENTIMENT_OPTIONS = ["negative", "neutral", "positive", "unclassified"] as const;

// 検索結果の型
interface SearchResultItem {
  id: number;
  keywordId: number;
  position: number;
  title: string;
  url: string;
  snippet: string | null;
  sentiment: "negative" | "neutral" | "positive" | "unclassified";
  reason: string | null;
  checkedAt: string;
}

export default function StatusPage() {
  // キーワード管理
  const [allKeywords, setAllKeywords] = useState<Keyword[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // キーワード追加フォーム
  const [newKeyword, setNewKeyword] = useState("");
  const [addingKeyword, setAddingKeyword] = useState(false);

  // サジェスト関連
  const [suggests, setSuggests] = useState<SuggestHistory[]>([]);
  const [fetchingSuggest, setFetchingSuggest] = useState(false);

  // 検索結果関連
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [scanning, setScanning] = useState(false);

  // 日付選択
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().split("T")[0];
  });

  // メッセージ
  const [message, setMessage] = useState("");

  // サジェストフィルター
  const [suggestFilter, setSuggestFilter] = useState<"all" | "negative" | "neutral" | "positive" | "unclassified">("all");

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
        setSuggests(await res.json());
      }
    } catch (error) {
      console.error("サジェスト取得エラー:", error);
    }
  }, [selectedKeywordId, selectedDate]);

  // 検索結果取得
  const fetchSearchResults = useCallback(async () => {
    if (!selectedKeywordId) return;
    try {
      const params = new URLSearchParams({
        keywordId: String(selectedKeywordId),
        date: selectedDate,
      });
      const res = await fetch(`/api/negative-articles?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("検索結果取得エラー:", error);
    }
  }, [selectedKeywordId, selectedDate]);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  useEffect(() => {
    if (selectedKeywordId) {
      fetchSuggests();
      fetchSearchResults();
    }
  }, [selectedKeywordId, selectedDate, fetchSuggests, fetchSearchResults]);

  // キーワード追加
  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    setAddingKeyword(true);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: newKeyword.trim() }),
      });
      if (res.ok) {
        setNewKeyword("");
        const data = await res.json();
        await fetchKeywords();
        setSelectedKeywordId(data.id);
      }
    } catch (error) {
      console.error("キーワード追加エラー:", error);
    } finally {
      setAddingKeyword(false);
    }
  };

  // キーワード削除
  const handleDeleteKeyword = async (id: number) => {
    if (!confirm("このキーワードとすべての関連データを削除しますか？")) return;
    try {
      const res = await fetch(`/api/keywords?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        const remaining = allKeywords.filter((k) => k.id !== id);
        setAllKeywords(remaining);
        if (selectedKeywordId === id) {
          setSelectedKeywordId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    } catch (error) {
      console.error("キーワード削除エラー:", error);
    }
  };

  // サジェスト取得実行
  const handleFetchSuggests = async () => {
    if (!selectedKeywordId) return;
    setFetchingSuggest(true);
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
    } catch {
      setMessage("サジェスト取得に失敗しました");
    } finally {
      setFetchingSuggest(false);
    }
  };

  // 検索スキャン実行
  const handleScan = async () => {
    if (!selectedKeywordId) return;
    setScanning(true);
    setMessage("");
    try {
      const res = await fetch("/api/negative-articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywordId: selectedKeywordId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        await fetchSearchResults();
      } else {
        setMessage(`エラー: ${data.error}`);
      }
    } catch {
      setMessage("検索スキャンに失敗しました");
    } finally {
      setScanning(false);
    }
  };

  // sentiment更新（サジェスト）
  const handleSuggestSentimentChange = async (id: number, sentiment: string) => {
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

  // sentiment更新（検索結果）
  const handleSearchSentimentChange = async (id: number, sentiment: string) => {
    try {
      const res = await fetch("/api/negative-articles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, sentiment }),
      });
      if (res.ok) {
        setSearchResults((prev) =>
          prev.map((s) => (s.id === id ? { ...s, sentiment: sentiment as SearchResultItem["sentiment"] } : s))
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

  // サジェストフィルター適用
  const filteredSuggests = useMemo(() => {
    if (suggestFilter === "all") return suggests;
    return suggests.filter((s) => s.sentiment === suggestFilter);
  }, [suggests, suggestFilter]);

  // sentiment別集計
  const sentimentCounts = suggests.reduce(
    (acc, s) => {
      acc[s.sentiment] = (acc[s.sentiment] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // 検索結果のsentiment別集計
  const searchStats = {
    total: searchResults.length,
    negative: searchResults.filter((r) => r.sentiment === "negative").length,
    neutral: searchResults.filter((r) => r.sentiment === "neutral").length,
    positive: searchResults.filter((r) => r.sentiment === "positive").length,
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
      {/* ヘッダー + キーワード追加 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">現状確認</h1>
          <p className="text-sm text-muted mt-1">
            サジェスト状況と検索順位を確認
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
            placeholder="新しいキーワード..."
            className="px-3 py-2 rounded-lg border border-navy-600 bg-navy-800 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 placeholder-gray-500 w-48"
          />
          <button
            onClick={handleAddKeyword}
            disabled={addingKeyword || !newKeyword.trim()}
            className="px-4 py-2 bg-accent-500 text-navy-900 rounded-lg hover:bg-accent-400 transition-colors font-medium text-sm disabled:opacity-50"
          >
            追加
          </button>
        </div>
      </div>

      {/* メッセージ */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.startsWith("エラー") ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"}`}>
          {message}
          <button onClick={() => setMessage("")} className="ml-3 text-xs opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* キーワードタブバー */}
      {allKeywords.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {allKeywords.map((kw) => (
            <div key={kw.id} className="flex items-center">
              <button
                onClick={() => setSelectedKeywordId(kw.id)}
                className={`px-4 py-2 rounded-l-lg text-sm font-medium transition-colors ${
                  selectedKeywordId === kw.id
                    ? "bg-accent-500 text-navy-900"
                    : "bg-navy-800 text-gray-400 hover:text-white border border-navy-600"
                }`}
              >
                {kw.keyword}
              </button>
              <button
                onClick={() => handleDeleteKeyword(kw.id)}
                className={`px-2 py-2 rounded-r-lg text-xs transition-colors ${
                  selectedKeywordId === kw.id
                    ? "bg-accent-600 text-navy-900 hover:bg-accent-700"
                    : "bg-navy-700 text-gray-500 hover:text-red-400 border border-l-0 border-navy-600"
                }`}
                title="削除"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* アクションバー */}
      {selectedKeywordId && (
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            {/* 日付選択 */}
            <div>
              <label className="block text-sm font-medium text-muted mb-1">日付</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeDate(-1)}
                  className="px-2 py-2 rounded-lg border border-navy-600 bg-navy-800 text-foreground hover:bg-navy-700 transition-colors"
                >
                  ◀
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
                  ▶
                </button>
              </div>
            </div>

            {/* サジェスト取得 */}
            <button
              onClick={handleFetchSuggests}
              disabled={fetchingSuggest}
              className="px-4 py-2 bg-accent-500 text-navy-900 rounded-lg hover:bg-accent-400 transition-colors font-medium text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {fetchingSuggest && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-navy-900" />}
              サジェスト取得
            </button>

            {/* 検索スキャン */}
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-4 py-2 bg-navy-700 text-foreground rounded-lg hover:bg-navy-600 transition-colors font-medium text-sm disabled:opacity-50 flex items-center gap-2 border border-navy-600"
            >
              {scanning && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-foreground" />}
              検索スキャン
            </button>
          </div>
        </div>
      )}

      {/* ===== サジェスト状況セクション ===== */}
      {selectedKeywordId && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">サジェスト状況</h2>

          {/* sentiment別サマリー */}
          {suggests.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
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
            {/* フィルター */}
            {suggests.length > 0 && (
              <div className="px-4 py-3 border-b border-navy-700 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted mr-1">フィルター:</span>
                {(["all", "negative", "neutral", "positive", "unclassified"] as const).map((s) => {
                  const labels: Record<string, string> = { all: "全て", negative: "ネガティブ", neutral: "ニュートラル", positive: "ポジティブ", unclassified: "未分類" };
                  const activeColors: Record<string, string> = {
                    all: "bg-accent-500 text-navy-900",
                    negative: "bg-red-600 text-white",
                    neutral: "bg-blue-600 text-white",
                    positive: "bg-green-600 text-white",
                    unclassified: "bg-gray-600 text-white",
                  };
                  const count = s === "all" ? suggests.length : (sentimentCounts[s] || 0);
                  return (
                    <button
                      key={s}
                      onClick={() => setSuggestFilter(s)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        suggestFilter === s
                          ? activeColors[s]
                          : "bg-navy-700 text-gray-400 hover:text-white"
                      }`}
                    >
                      {labels[s]} ({count})
                    </button>
                  );
                })}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-navy-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-12">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">サジェストテキスト</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-40">分類</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-700">
                  {filteredSuggests.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted">
                        {suggests.length === 0
                          ? "サジェストデータがありません。「サジェスト取得」ボタンで取得してください。"
                          : "フィルター条件に一致するサジェストがありません"}
                      </td>
                    </tr>
                  ) : (
                    filteredSuggests.map((s) => {
                      const config = SENTIMENT_CONFIG[s.sentiment];
                      return (
                        <tr key={s.id} className="hover:bg-navy-800/50 transition-colors">
                          <td className="px-4 py-3 text-sm text-muted">{s.position + 1}</td>
                          <td className="px-4 py-3 text-sm text-foreground font-medium">{s.suggestText}</td>
                          <td className="px-4 py-3">
                            <select
                              value={s.sentiment}
                              onChange={(e) => handleSuggestSentimentChange(s.id, e.target.value)}
                              className={`px-2 py-1 rounded text-xs font-medium border-none focus:outline-none focus:ring-2 focus:ring-accent-500 cursor-pointer ${config.bg} ${config.color}`}
                            >
                              {SENTIMENT_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>{SENTIMENT_CONFIG[opt].label}</option>
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
        </div>
      )}

      {/* ===== 検索順位状況セクション ===== */}
      {selectedKeywordId && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">検索順位状況（30位以内）</h2>

          {/* 統計カード */}
          {searchResults.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="card p-3 border-none bg-navy-800">
                <div className="text-xs font-medium text-gray-400">検索結果数</div>
                <div className="text-2xl font-bold text-white">{searchStats.total}</div>
              </div>
              <div className="card p-3 border-none bg-red-500/20">
                <div className="text-xs font-medium text-red-400">ネガティブ</div>
                <div className="text-2xl font-bold text-red-400">{searchStats.negative}</div>
              </div>
              <div className="card p-3 border-none bg-blue-500/20">
                <div className="text-xs font-medium text-blue-400">ニュートラル</div>
                <div className="text-2xl font-bold text-blue-400">{searchStats.neutral}</div>
              </div>
              <div className="card p-3 border-none bg-green-500/20">
                <div className="text-xs font-medium text-green-400">ポジティブ</div>
                <div className="text-2xl font-bold text-green-400">{searchStats.positive}</div>
              </div>
            </div>
          )}

          {/* 検索結果テーブル */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-navy-900/50 border-b border-navy-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium w-12">#</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">タイトル / URL</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium w-32">判定</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium w-48">判定理由</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium w-36">変更</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-700">
                  {searchResults.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted">
                        データがありません。「検索スキャン」をクリックして取得してください。
                      </td>
                    </tr>
                  ) : (
                    searchResults.map((item) => {
                      const sentConfig = {
                        negative: { label: "ネガティブ", badge: "bg-red-500/20 text-red-400 border-red-500/30", dot: "bg-red-500" },
                        neutral: { label: "ニュートラル", badge: "bg-blue-500/20 text-blue-400 border-blue-500/30", dot: "bg-blue-500" },
                        positive: { label: "ポジティブ", badge: "bg-green-500/20 text-green-400 border-green-500/30", dot: "bg-green-500" },
                        unclassified: { label: "未分類", badge: "bg-gray-500/20 text-gray-400 border-gray-500/30", dot: "bg-gray-500" },
                      }[item.sentiment];
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-navy-700/50 transition-colors ${item.sentiment === "negative" ? "bg-red-500/5" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <RankBadge rank={item.position} />
                          </td>
                          <td className="px-4 py-3">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-white hover:text-accent-400 font-medium transition-colors line-clamp-1"
                            >
                              {item.title}
                            </a>
                            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-md">{item.url}</p>
                            {item.snippet && (
                              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{item.snippet}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${sentConfig.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sentConfig.dot}`} />
                              {sentConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-gray-400 line-clamp-2">{item.reason || "-"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={item.sentiment}
                              onChange={(e) => handleSearchSentimentChange(item.id, e.target.value)}
                              className="w-full px-2 py-1 bg-navy-900 border border-navy-600 rounded text-xs text-white focus:ring-1 focus:ring-accent-500"
                            >
                              <option value="negative">ネガティブ</option>
                              <option value="neutral">ニュートラル</option>
                              <option value="positive">ポジティブ</option>
                              <option value="unclassified">未分類</option>
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

          {/* ネガティブ記事アラート */}
          {searchStats.negative > 0 && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <h3 className="text-red-400 font-bold text-sm">
                    ネガティブ記事が {searchStats.negative} 件検出されました
                  </h3>
                  <p className="text-red-400/70 text-xs mt-1">
                    「対策アドバイス」ページでAI分析を実行し、対策を検討してください。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* キーワード未登録の場合 */}
      {allKeywords.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-muted mb-4">キーワードが登録されていません</p>
          <p className="text-sm text-muted">上部のフォームからキーワードを追加してください</p>
        </div>
      )}
    </div>
  );
}

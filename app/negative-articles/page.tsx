"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// 型定義
interface Keyword {
  id: number;
  keyword: string;
  isActive: boolean;
}

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

// 登録済みURL型
interface TrackedUrl {
  id: number;
  keywordId: number;
  url: string;
  type: string;
  label: string | null;
}

// sentiment表示用
const SENTIMENT_CONFIG = {
  negative: { label: "ネガティブ", color: "bg-red-500", textColor: "text-red-400", badge: "bg-red-500/20 text-red-400 border-red-500/30" },
  neutral: { label: "ニュートラル", color: "bg-blue-500", textColor: "text-blue-400", badge: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  positive: { label: "ポジティブ", color: "bg-green-500", textColor: "text-green-400", badge: "bg-green-500/20 text-green-400 border-green-500/30" },
  unclassified: { label: "未分類", color: "bg-gray-500", textColor: "text-gray-400", badge: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

export default function NegativeArticlesPage() {
  // 状態管理
  const [keywordsList, setKeywordsList] = useState<Keyword[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<number | null>(null);
  const [searchResultItems, setSearchResultItems] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanningAll, setScanningAll] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    return `${jstNow.getFullYear()}-${String(jstNow.getMonth() + 1).padStart(2, "0")}-${String(jstNow.getDate()).padStart(2, "0")}`;
  });
  const [filterMode, setFilterMode] = useState<"all" | "negative" | "neutral" | "positive" | "unclassified">("all");
  const [sortKey, setSortKey] = useState<"position" | "sentiment">("position");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [message, setMessage] = useState<string | null>(null);
  const [trackedUrls, setTrackedUrls] = useState<TrackedUrl[]>([]);
  const [registeringUrl, setRegisteringUrl] = useState<number | null>(null); // 登録中のsearchResult ID

  // キーワード一覧取得
  useEffect(() => {
    fetch("/api/keywords")
      .then((res) => res.json())
      .then((data) => {
        const active = data.filter((k: Keyword) => k.isActive);
        setKeywordsList(active);
        if (active.length > 0 && !selectedKeywordId) {
          setSelectedKeywordId(active[0].id);
        }
      })
      .catch((err) => console.error("キーワード取得エラー:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 登録済みURL取得
  const fetchTrackedUrls = useCallback(async () => {
    if (!selectedKeywordId) return;
    try {
      const res = await fetch(`/api/urls?keywordId=${selectedKeywordId}`);
      const data = await res.json();
      setTrackedUrls(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("登録済みURL取得エラー:", err);
    }
  }, [selectedKeywordId]);

  // キーワード変更時に登録済みURLも取得
  useEffect(() => {
    fetchTrackedUrls();
  }, [fetchTrackedUrls]);

  // 検索結果取得（常に全件取得し、フィルターはフロントで適用）
  const fetchResults = useCallback(async () => {
    if (!selectedKeywordId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        keywordId: String(selectedKeywordId),
        date: selectedDate,
      });
      const res = await fetch(`/api/negative-articles?${params.toString()}`);
      const data = await res.json();
      setSearchResultItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("検索結果取得エラー:", err);
      setSearchResultItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedKeywordId, selectedDate]);

  // キーワード・日付・フィルター変更時にデータ取得
  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // スキャン実行（個別キーワード）
  const handleScan = async () => {
    if (!selectedKeywordId) return;
    setScanning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/negative-articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywordId: selectedKeywordId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        await fetchResults();
      } else {
        setMessage(`エラー: ${data.error}`);
      }
    } catch (err) {
      setMessage("スキャンに失敗しました");
    } finally {
      setScanning(false);
    }
  };

  // 全キーワード一括スキャン
  const handleScanAll = async () => {
    setScanningAll(true);
    setMessage(null);
    try {
      const res = await fetch("/api/negative-articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        await fetchResults();
      } else {
        setMessage(`エラー: ${data.error}`);
      }
    } catch (err) {
      setMessage("一括スキャンに失敗しました");
    } finally {
      setScanningAll(false);
    }
  };

  // キャッシュリセット＋再スキャン
  const handleRescan = async () => {
    if (!selectedKeywordId) return;
    setScanning(true);
    setMessage(null);
    try {
      // 1. 当日キャッシュ削除
      const delRes = await fetch(
        `/api/negative-articles?keywordId=${selectedKeywordId}`,
        { method: "DELETE" }
      );
      const delData = await delRes.json();
      if (!delRes.ok) {
        setMessage(`キャッシュ削除エラー: ${delData.error}`);
        setScanning(false);
        return;
      }

      // 2. 再スキャン実行
      const res = await fetch("/api/negative-articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywordId: selectedKeywordId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`キャッシュをリセットして再取得しました。${data.message}`);
        await fetchResults();
      } else {
        setMessage(`エラー: ${data.error}`);
      }
    } catch (err) {
      setMessage("再スキャンに失敗しました");
    } finally {
      setScanning(false);
    }
  };

  // URL登録（ネガティブ記事をURL管理に追加）
  const handleRegisterUrl = async (item: SearchResultItem) => {
    if (!selectedKeywordId) return;
    setRegisteringUrl(item.id);
    try {
      const type = item.sentiment === "positive" ? "positive" : "negative";
      const res = await fetch("/api/urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywordId: selectedKeywordId,
          url: item.url,
          type,
          label: item.title,
        }),
      });
      if (res.ok) {
        setMessage(`URL登録完了: ${item.title}`);
        await fetchTrackedUrls(); // 登録済みリスト更新
      } else {
        const data = await res.json();
        setMessage(`URL登録エラー: ${data.error}`);
      }
    } catch (err) {
      setMessage("URL登録に失敗しました");
    } finally {
      setRegisteringUrl(null);
    }
  };

  // URLが登録済みかチェック
  const isUrlRegistered = (url: string): boolean => {
    return trackedUrls.some(
      (t) => t.url === url || url.includes(t.url) || t.url.includes(url)
    );
  };

  // sentiment手動変更
  const handleSentimentChange = async (id: number, newSentiment: string) => {
    try {
      const res = await fetch("/api/negative-articles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, sentiment: newSentiment }),
      });
      if (res.ok) {
        setSearchResultItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, sentiment: newSentiment as SearchResultItem["sentiment"] }
              : item
          )
        );
      }
    } catch (err) {
      console.error("sentiment更新エラー:", err);
    }
  };

  // 日付移動
  const moveDate = (days: number) => {
    const current = new Date(selectedDate + "T00:00:00");
    current.setDate(current.getDate() + days);
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    setSelectedDate(`${y}-${m}-${d}`);
  };

  // フィルター+ソート適用
  const filteredItems = useMemo(() => {
    // センチメントの優先度マップ（ソート用）
    const sentimentOrder: Record<string, number> = {
      negative: 0,
      neutral: 1,
      positive: 2,
      unclassified: 3,
    };
    let result = searchResultItems;

    // センチメントフィルター
    if (filterMode !== "all") {
      result = result.filter((r) => r.sentiment === filterMode);
    }

    // ソート
    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "position":
          cmp = a.position - b.position;
          break;
        case "sentiment":
          cmp = (sentimentOrder[a.sentiment] ?? 99) - (sentimentOrder[b.sentiment] ?? 99);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [searchResultItems, filterMode, sortKey, sortDir]);

  // 統計計算（全件ベース）
  const stats = {
    total: searchResultItems.length,
    negative: searchResultItems.filter((r) => r.sentiment === "negative").length,
    neutral: searchResultItems.filter((r) => r.sentiment === "neutral").length,
    positive: searchResultItems.filter((r) => r.sentiment === "positive").length,
    unclassified: searchResultItems.filter((r) => r.sentiment === "unclassified").length,
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">ネガティブ記事検出</h1>
          <p className="text-sm text-gray-400 mt-1">
            Google検索結果をAIで分析し、ネガティブな記事を自動検出します
          </p>
        </div>
        <button
          onClick={handleScanAll}
          disabled={scanningAll || scanning}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {scanningAll ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              分析中...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              全キーワード一括スキャン
            </>
          )}
        </button>
      </div>

      {/* メッセージ表示 */}
      {message && (
        <div
          className={`p-4 rounded-lg text-sm font-medium ${
            message.includes("エラー") || message.includes("失敗")
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : message.includes("ネガティブ記事を検出")
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                : "bg-green-500/20 text-green-400 border border-green-500/30"
          }`}
        >
          {message}
          <button
            onClick={() => setMessage(null)}
            className="ml-4 text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* キーワード選択 + 操作 */}
      <div className="bg-navy-800 rounded-xl border border-navy-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* キーワード選択 */}
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1.5">
              キーワード
            </label>
            <select
              value={selectedKeywordId || ""}
              onChange={(e) => setSelectedKeywordId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-navy-900 border border-navy-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-accent-500 focus:border-transparent"
            >
              {keywordsList.map((kw) => (
                <option key={kw.id} value={kw.id}>
                  {kw.keyword}
                </option>
              ))}
            </select>
          </div>

          {/* 日付選択 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">日付</label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => moveDate(-1)}
                className="px-2 py-2 bg-navy-700 hover:bg-navy-600 rounded-lg text-gray-300 text-sm transition-colors"
              >
                ◀
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 bg-navy-900 border border-navy-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              />
              <button
                onClick={() => moveDate(1)}
                className="px-2 py-2 bg-navy-700 hover:bg-navy-600 rounded-lg text-gray-300 text-sm transition-colors"
              >
                ▶
              </button>
            </div>
          </div>

          {/* スキャンボタン */}
          <div className="flex items-end gap-2">
            <button
              onClick={handleScan}
              disabled={scanning || scanningAll || !selectedKeywordId}
              className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-navy-900 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {scanning ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  分析中...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  スキャン実行
                </>
              )}
            </button>
            {/* キャッシュリセット＋再スキャンボタン */}
            <button
              onClick={handleRescan}
              disabled={scanning || scanningAll || !selectedKeywordId}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="当日のキャッシュを削除して最新データで再取得します"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
              </svg>
              再取得
            </button>
          </div>
        </div>
      </div>

      {/* 統計カード */}
      {searchResultItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-navy-800 rounded-xl border border-navy-700 p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-gray-400 mt-1">検索結果数</p>
          </div>
          {(["negative", "neutral", "positive"] as const).map((s) => {
            const colorMap = {
              negative: { text: "text-red-400", border: "border-red-500", ring: "ring-red-500", hover: "hover:border-red-500/50" },
              neutral: { text: "text-blue-400", border: "border-blue-500", ring: "ring-blue-500", hover: "hover:border-blue-500/50" },
              positive: { text: "text-green-400", border: "border-green-500", ring: "ring-green-500", hover: "hover:border-green-500/50" },
            };
            const labelMap = { negative: "ネガティブ", neutral: "ニュートラル", positive: "ポジティブ" };
            const c = colorMap[s];
            return (
              <div
                key={s}
                className={`bg-navy-800 rounded-xl border p-4 text-center cursor-pointer transition-all ${
                  filterMode === s
                    ? `${c.border} ring-1 ${c.ring}`
                    : `border-navy-700 ${c.hover}`
                }`}
                onClick={() => setFilterMode(filterMode === s ? "all" : s)}
              >
                <p className={`text-2xl font-bold ${c.text}`}>{stats[s]}</p>
                <p className="text-xs text-gray-400 mt-1">{labelMap[s]}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* フィルター・ソートバー */}
      <div className="flex flex-wrap items-center gap-2">
        {/* センチメントフィルター */}
        {(["all", "negative", "neutral", "positive", "unclassified"] as const).map((mode) => {
          const labelMap: Record<string, string> = {
            all: "全件",
            negative: "ネガティブ",
            neutral: "ニュートラル",
            positive: "ポジティブ",
            unclassified: "未分類",
          };
          const activeColorMap: Record<string, string> = {
            all: "bg-accent-500 text-navy-900",
            negative: "bg-red-600 text-white",
            neutral: "bg-blue-600 text-white",
            positive: "bg-green-600 text-white",
            unclassified: "bg-gray-600 text-white",
          };
          return (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterMode === mode
                  ? activeColorMap[mode]
                  : "bg-navy-800 text-gray-400 hover:text-white border border-navy-700"
              }`}
            >
              {labelMap[mode]}
              {mode !== "all" && ` (${stats[mode as keyof typeof stats]})`}
            </button>
          );
        })}

        {/* 区切り線 */}
        <div className="w-px h-6 bg-navy-700 mx-1" />

        {/* ソート */}
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as "position" | "sentiment")}
          className="px-3 py-1.5 bg-navy-800 border border-navy-700 rounded-lg text-gray-300 text-xs focus:ring-2 focus:ring-accent-500 focus:border-transparent"
        >
          <option value="position">順位順</option>
          <option value="sentiment">判定順</option>
        </select>
        <button
          onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
          className="px-3 py-1.5 bg-navy-800 border border-navy-700 rounded-lg text-gray-300 text-xs hover:bg-navy-700 transition-colors"
          title={sortDir === "asc" ? "昇順" : "降順"}
        >
          {sortDir === "asc" ? "▲" : "▼"}
        </button>
      </div>

      {/* 検索結果テーブル */}
      <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-accent-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="ml-2 text-gray-400 text-sm">読み込み中...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mx-auto text-gray-600 mb-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-gray-500 text-sm">
              データがありません。「スキャン実行」をクリックして検索結果を取得してください。
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy-900/50 border-b border-navy-700">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium w-12">
                    #
                  </th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">
                    タイトル / URL
                  </th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium w-32">
                    判定
                  </th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium w-48">
                    判定理由
                  </th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium w-36">
                    変更
                  </th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium w-28">
                    URL登録
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700">
                {filteredItems.map((item) => {
                  const config = SENTIMENT_CONFIG[item.sentiment];
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-navy-700/50 transition-colors ${
                        item.sentiment === "negative"
                          ? "bg-red-500/5"
                          : ""
                      }`}
                    >
                      {/* 順位 */}
                      <td className="px-4 py-3">
                        <span className="text-gray-300 font-mono font-bold">
                          {item.position}
                        </span>
                      </td>

                      {/* タイトル・URL・スニペット */}
                      <td className="px-4 py-3">
                        <div>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white hover:text-accent-400 font-medium transition-colors line-clamp-1"
                          >
                            {item.title}
                          </a>
                          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-md">
                            {item.url}
                          </p>
                          {item.snippet && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                              {item.snippet}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* 判定バッジ */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.badge}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${config.color}`}
                          />
                          {config.label}
                        </span>
                      </td>

                      {/* 判定理由 */}
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-400 line-clamp-2">
                          {item.reason || "-"}
                        </p>
                      </td>

                      {/* 分類変更 */}
                      <td className="px-4 py-3">
                        <select
                          value={item.sentiment}
                          onChange={(e) =>
                            handleSentimentChange(item.id, e.target.value)
                          }
                          className="w-full px-2 py-1 bg-navy-900 border border-navy-600 rounded text-xs text-white focus:ring-1 focus:ring-accent-500"
                        >
                          <option value="negative">ネガティブ</option>
                          <option value="neutral">ニュートラル</option>
                          <option value="positive">ポジティブ</option>
                          <option value="unclassified">未分類</option>
                        </select>
                      </td>

                      {/* URL登録 */}
                      <td className="px-4 py-3">
                        {isUrlRegistered(item.url) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            登録済
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRegisterUrl(item)}
                            disabled={registeringUrl === item.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-accent-500/20 text-accent-400 border border-accent-500/30 hover:bg-accent-500/30 transition-colors disabled:opacity-50"
                          >
                            {registeringUrl === item.id ? (
                              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                            )}
                            登録
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ネガティブ記事アラートセクション */}
      {stats.negative > 0 && filterMode === "all" && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <h3 className="text-red-400 font-bold text-sm">
                ネガティブ記事が {stats.negative} 件検出されました
              </h3>
              <p className="text-red-400/70 text-xs mt-1">
                上位検索結果にネガティブな内容の記事が含まれています。
                「サジェスト対策」ページでの対策アドバイスも併せてご確認ください。
              </p>
              <div className="mt-3 space-y-2">
                {searchResultItems
                  .filter((r) => r.sentiment === "negative")
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2 text-xs"
                    >
                      <span className="text-red-400 font-mono font-bold min-w-[2rem]">
                        {item.position}位
                      </span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-300 hover:text-red-200 transition-colors"
                      >
                        {item.title}
                      </a>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

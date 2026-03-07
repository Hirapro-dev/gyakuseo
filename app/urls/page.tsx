"use client";

import { useState, useEffect, useCallback } from "react";
import { UrlTypeBadge, RankBadge, RankChange } from "@/components/UrlStatusBadge";
import type { Keyword, TrackedUrl, RankingHistory } from "@/lib/schema";

interface TrackedUrlWithKeyword extends TrackedUrl {
  keyword?: Keyword;
}

// カテゴリ定義
type UrlType = "negative" | "positive" | "neutral";

const CATEGORY_CONFIG: Record<
  UrlType,
  {
    label: string;
    icon: string;
    headerBg: string;
    borderColor: string;
    dotColor: string;
    emptyText: string;
  }
> = {
  negative: {
    label: "ネガティブ",
    icon: "🔴",
    headerBg: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800/50",
    dotColor: "bg-red-500",
    emptyText: "ネガティブURLは登録されていません",
  },
  positive: {
    label: "ポジティブ",
    icon: "🟢",
    headerBg: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-800/50",
    dotColor: "bg-green-500",
    emptyText: "ポジティブURLは登録されていません",
  },
  neutral: {
    label: "ニュートラル",
    icon: "🔵",
    headerBg: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800/50",
    dotColor: "bg-blue-500",
    emptyText: "ニュートラルURLは登録されていません",
  },
};

// カテゴリごとの行色
const ROW_COLORS: Record<UrlType, string> = {
  negative: "hover:bg-red-50/50 dark:hover:bg-red-950/20",
  positive: "hover:bg-green-50/50 dark:hover:bg-green-950/20",
  neutral: "hover:bg-blue-50/50 dark:hover:bg-blue-950/20",
};

export default function UrlsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [urls, setUrls] = useState<TrackedUrlWithKeyword[]>([]);
  const [rankingData, setRankingData] = useState<RankingHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // フォーム状態
  const [selectedKeywordId, setSelectedKeywordId] = useState<number | "">("");
  const [newUrl, setNewUrl] = useState("");
  const [newType, setNewType] = useState<UrlType>("negative");
  const [newLabel, setNewLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 計測状態
  const [measuring, setMeasuring] = useState(false);
  const [measureResult, setMeasureResult] = useState<string | null>(null);

  // フィルター
  const [filterKeywordId, setFilterKeywordId] = useState<number | "all">("all");

  // データ取得
  const fetchData = useCallback(async () => {
    try {
      const [kwRes, urlRes] = await Promise.all([
        fetch("/api/keywords"),
        fetch("/api/urls"),
      ]);

      const kwData: Keyword[] = await kwRes.json();
      const urlData: TrackedUrlWithKeyword[] = await urlRes.json();

      setKeywords(kwData);
      setUrls(urlData);

      // 全キーワードの順位履歴を取得
      const allHistory: RankingHistory[] = [];
      await Promise.all(
        kwData.map(async (kw) => {
          const rankRes = await fetch(
            `/api/rankings?keywordId=${kw.id}&limit=200`
          );
          const rankData: RankingHistory[] = await rankRes.json();
          allHistory.push(...rankData);
        })
      );
      setRankingData(allHistory);
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // URL追加
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKeywordId || !newUrl.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywordId: selectedKeywordId,
          url: newUrl,
          type: newType,
          label: newLabel || null,
        }),
      });

      if (res.ok) {
        setNewUrl("");
        setNewLabel("");
        await fetchData();
      } else {
        const error = await res.json();
        alert(`追加エラー: ${error.error}`);
      }
    } catch (error) {
      console.error("URL追加エラー:", error);
      alert("URLの追加に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  // URL削除
  const handleDelete = async (id: number) => {
    if (!confirm("このURLを削除しますか？")) return;

    try {
      const res = await fetch(`/api/urls?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchData();
      } else {
        const error = await res.json();
        alert(`削除エラー: ${error.error}`);
      }
    } catch (error) {
      console.error("URL削除エラー:", error);
    }
  };

  // URLの種別変更
  const handleTypeChange = async (id: number, newTypeVal: UrlType) => {
    try {
      const res = await fetch("/api/urls", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type: newTypeVal }),
      });

      if (res.ok) {
        await fetchData();
      } else {
        const error = await res.json();
        alert(`変更エラー: ${error.error}`);
      }
    } catch (error) {
      console.error("種別変更エラー:", error);
    }
  };

  // URLの最新順位・前回順位を取得
  const getUrlRank = (
    url: string,
    keywordId: number
  ): { latest: number | null; previous: number | null } => {
    const history = rankingData
      .filter((h) => h.url === url && h.keywordId === keywordId)
      .sort(
        (a, b) =>
          new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
      );

    return {
      latest: history[0]?.rank ?? null,
      previous: history[1]?.rank ?? null,
    };
  };

  // 手動計測実行
  const handleMeasure = async () => {
    setMeasuring(true);
    setMeasureResult(null);
    try {
      const body = filterKeywordId !== "all" ? { keywordId: filterKeywordId } : {};
      const res = await fetch("/api/measure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setMeasureResult(
          `計測完了: ${data.processed}件のURL順位を取得しました`
        );
        await fetchData();
      } else {
        setMeasureResult(`計測エラー: ${data.error}`);
      }
    } catch (error) {
      console.error("計測エラー:", error);
      setMeasureResult("計測に失敗しました");
    } finally {
      setMeasuring(false);
      setTimeout(() => setMeasureResult(null), 5000);
    }
  };

  // キーワードフィルター適用
  const filteredUrls = urls.filter((u) => {
    return filterKeywordId === "all" || u.keywordId === filterKeywordId;
  });

  // カテゴリ別にURLを分類
  const categorizedUrls: Record<UrlType, TrackedUrlWithKeyword[]> = {
    negative: filteredUrls.filter((u) => u.type === "negative"),
    positive: filteredUrls.filter((u) => u.type === "positive"),
    neutral: filteredUrls.filter((u) => u.type === "neutral"),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">読み込み中...</div>
      </div>
    );
  }

  // カテゴリ別テーブル描画
  const renderCategoryTable = (type: UrlType) => {
    const config = CATEGORY_CONFIG[type];
    const categoryUrls = categorizedUrls[type];

    return (
      <div
        key={type}
        className={`bg-white dark:bg-navy-900 rounded-xl border ${config.borderColor} overflow-hidden`}
      >
        {/* カテゴリヘッダー */}
        <div
          className={`px-6 py-4 ${config.headerBg} border-b ${config.borderColor} flex items-center justify-between`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`w-3 h-3 rounded-full ${config.dotColor}`}
            />
            <h2 className="text-lg font-bold">
              {config.label} ({categoryUrls.length}件)
            </h2>
          </div>
        </div>

        {/* テーブル */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-navy-900">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  キーワード
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  URL
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  種別
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  最新順位
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  前回比
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-navy-950 divide-y divide-gray-200 dark:divide-gray-700">
              {categoryUrls.map((u) => {
                const rank = getUrlRank(u.url, u.keywordId);
                const kwName =
                  u.keyword?.keyword ||
                  keywords.find((k) => k.id === u.keywordId)?.keyword ||
                  "-";

                return (
                  <tr
                    key={u.id}
                    className={ROW_COLORS[type]}
                  >
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-200 text-xs font-mono font-bold">
                        #{u.id}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {kwName}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {u.label || "-"}
                        </p>
                        <p className="text-xs text-gray-400 truncate max-w-xs">
                          {u.url}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <select
                        value={u.type}
                        onChange={(e) =>
                          handleTypeChange(u.id, e.target.value as UrlType)
                        }
                        className="px-2 py-1 border border-gray-300 dark:border-navy-600 rounded-md bg-white dark:bg-navy-950 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent-500"
                      >
                        <option value="negative">ネガティブ</option>
                        <option value="positive">ポジティブ</option>
                        <option value="neutral">ニュートラル</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {rank.latest !== null ? (
                        <RankBadge rank={rank.latest} />
                      ) : (
                        <span className="text-xs text-gray-400">未計測</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <RankChange
                        current={rank.latest ?? 0}
                        previous={rank.previous}
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="text-red-600 dark:text-red-400 hover:underline text-sm"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
              {categoryUrls.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 text-sm"
                  >
                    {config.emptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">URL管理</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            キーワードに対するURL（ネガティブ・ポジティブ・ニュートラル）を管理
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* キーワードフィルター */}
          <select
            value={filterKeywordId === "all" ? "all" : filterKeywordId}
            onChange={(e) =>
              setFilterKeywordId(
                e.target.value === "all" ? "all" : parseInt(e.target.value)
              )
            }
            className="px-3 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            <option value="all">全キーワード</option>
            {keywords.map((kw) => (
              <option key={kw.id} value={kw.id}>
                {kw.keyword}
              </option>
            ))}
          </select>
          <button
            onClick={handleMeasure}
            disabled={measuring || urls.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-navy-950 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            {measuring ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                計測中...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                順位を計測
              </>
            )}
          </button>
        </div>
      </div>

      {/* 計測結果メッセージ */}
      {measureResult && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            measureResult.includes("エラー") || measureResult.includes("失敗")
              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
              : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
          }`}
        >
          {measureResult}
        </div>
      )}

      {/* 統計サマリー */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 px-5 py-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">登録URL数</p>
          <p className="text-2xl font-bold">{filteredUrls.length}</p>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-red-200 dark:border-red-800/50 px-5 py-4">
          <p className="text-xs text-red-500 dark:text-red-400 mb-1">🔴 ネガティブ</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {categorizedUrls.negative.length}
          </p>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-green-200 dark:border-green-800/50 px-5 py-4">
          <p className="text-xs text-green-500 dark:text-green-400 mb-1">🟢 ポジティブ</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {categorizedUrls.positive.length}
          </p>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-blue-200 dark:border-blue-800/50 px-5 py-4">
          <p className="text-xs text-blue-500 dark:text-blue-400 mb-1">🔵 ニュートラル</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {categorizedUrls.neutral.length}
          </p>
        </div>
      </div>

      {/* URL追加フォーム */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 p-6">
        <h2 className="text-lg font-bold mb-4">URLを追加</h2>
        {keywords.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            先にキーワードを登録してください
          </p>
        ) : (
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={selectedKeywordId}
                onChange={(e) =>
                  setSelectedKeywordId(
                    e.target.value ? parseInt(e.target.value) : ""
                  )
                }
                className="px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                required
              >
                <option value="">キーワードを選択</option>
                {keywords.map((kw) => (
                  <option key={kw.id} value={kw.id}>
                    {kw.keyword}
                  </option>
                ))}
              </select>

              <select
                value={newType}
                onChange={(e) =>
                  setNewType(e.target.value as UrlType)
                }
                className="px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              >
                <option value="negative">ネガティブ</option>
                <option value="positive">ポジティブ</option>
                <option value="neutral">ニュートラル</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
                required
              />
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="サイト名・説明（任意）"
                className="sm:w-48 px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-navy-950 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                {submitting ? "追加中..." : "追加"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* カテゴリ別URL一覧 */}
      {(["negative", "positive", "neutral"] as UrlType[]).map((type) =>
        renderCategoryTable(type)
      )}
    </div>
  );
}

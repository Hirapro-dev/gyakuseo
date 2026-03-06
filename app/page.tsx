"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RankBadge } from "@/components/UrlStatusBadge";
import { RankingChart } from "@/components/RankingChart";
import type { Keyword, TrackedUrl, RankingHistory, PublishLog, Article } from "@/lib/schema";

// キーワードとURL情報を含む型
interface KeywordWithUrls extends Keyword {
  trackedUrls: TrackedUrl[];
}

// 投稿ログ＋記事情報の型
interface PublishLogWithArticle extends PublishLog {
  article?: Article | null;
}

// プラットフォーム表示名
const PLATFORM_NAMES: Record<string, string> = {
  note: "note", ameblo: "アメブロ", linkedin: "LinkedIn",
  x: "X", facebook: "Facebook", instagram: "Instagram", wordpress: "WordPress",
};

const STATUS_COLORS: Record<string, string> = {
  success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  manual: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const STATUS_LABELS: Record<string, string> = {
  success: "成功", failed: "失敗", pending: "待機中", manual: "手動",
};

// URLごとの最新順位情報
interface UrlRankInfo {
  url: string;
  label: string | null;
  type: "negative" | "positive";
  latestRank: number | null;
  previousRank: number | null;
}

export default function DashboardPage() {
  const [keywords, setKeywords] = useState<KeywordWithUrls[]>([]);
  const [rankingData, setRankingData] = useState<
    Map<number, RankingHistory[]>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [measuring, setMeasuring] = useState<number | null>(null);
  const [measuringAll, setMeasuringAll] = useState(false);
  const [publishLogs, setPublishLogs] = useState<PublishLogWithArticle[]>([]);

  // データ取得
  const fetchData = useCallback(async () => {
    try {
      const kwRes = await fetch("/api/keywords");
      const kwData: KeywordWithUrls[] = await kwRes.json();
      setKeywords(kwData);

      // 各キーワードの順位履歴を取得
      const rankMap = new Map<number, RankingHistory[]>();
      await Promise.all(
        kwData.map(async (kw) => {
          const rankRes = await fetch(
            `/api/rankings?keywordId=${kw.id}&limit=100`
          );
          const rankData: RankingHistory[] = await rankRes.json();
          rankMap.set(kw.id, rankData);
        })
      );
      setRankingData(rankMap);

      // 投稿ログ取得
      try {
        const logRes = await fetch("/api/publish-logs");
        const logData: PublishLogWithArticle[] = await logRes.json();
        setPublishLogs(Array.isArray(logData) ? logData : []);
      } catch {
        // 投稿ログ取得失敗は無視（メイン機能に影響しない）
      }
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 特定キーワードの順位計測
  const measureRanking = async (keywordId: number) => {
    setMeasuring(keywordId);
    try {
      const res = await fetch("/api/rankings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywordId }),
      });

      if (res.ok) {
        await fetchData();
      } else {
        const error = await res.json();
        alert(`計測エラー: ${error.error}`);
      }
    } catch (error) {
      console.error("計測エラー:", error);
      alert("計測に失敗しました");
    } finally {
      setMeasuring(null);
    }
  };

  // 全キーワード一括計測
  const measureAll = async () => {
    setMeasuringAll(true);
    try {
      const activeKeywords = keywords.filter((kw) => kw.isActive);
      for (const kw of activeKeywords) {
        await measureRanking(kw.id);
      }
    } finally {
      setMeasuringAll(false);
    }
  };

  // URLごとの最新順位情報を取得
  const getUrlRankInfo = (
    keywordId: number,
    urls: TrackedUrl[]
  ): UrlRankInfo[] => {
    const history = rankingData.get(keywordId) || [];

    return urls.map((u) => {
      const urlHistory = history
        .filter((h) => h.url === u.url)
        .sort(
          (a, b) =>
            new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
        );

      return {
        url: u.url,
        label: u.label,
        type: u.type as "negative" | "positive",
        latestRank: urlHistory[0]?.rank ?? null,
        previousRank: urlHistory[1]?.rank ?? null,
      };
    });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ダッシュボード</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            登録キーワードの順位状況一覧
          </p>
        </div>
        <button
          onClick={measureAll}
          disabled={measuringAll}
          className="px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-navy-950 rounded-lg text-sm font-medium transition-colors"
        >
          {measuringAll ? "計測中..." : "全キーワード一括計測"}
        </button>
      </div>

      {/* 投稿ログタイムライン */}
      {publishLogs.length > 0 && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-navy-700 flex items-center justify-between">
            <h2 className="text-sm font-bold">直近の投稿ログ</h2>
            <Link href="/articles" className="text-xs text-accent-500 hover:text-accent-400">
              記事管理へ →
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-navy-800 max-h-64 overflow-y-auto">
            {publishLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="px-6 py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[log.status] || ""}`}>
                    {STATUS_LABELS[log.status] || log.status}
                  </span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {PLATFORM_NAMES[log.platform] || log.platform}
                  </span>
                  {log.article && (
                    <span className="text-gray-400 truncate max-w-[200px]">
                      {log.article.title}
                    </span>
                  )}
                </div>
                <span className="text-gray-400 whitespace-nowrap">
                  {new Date(log.publishedAt).toLocaleString("ja-JP", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* キーワードが未登録の場合 */}
      {keywords.length === 0 && (
        <div className="bg-white dark:bg-navy-900 rounded-xl p-12 text-center border border-gray-200 dark:border-navy-700">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            キーワードが登録されていません
          </p>
          <Link
            href="/keywords"
            className="inline-block px-4 py-2 bg-accent-500 hover:bg-accent-600 text-navy-950 rounded-lg text-sm font-medium transition-colors"
          >
            キーワードを登録する
          </Link>
        </div>
      )}

      {/* キーワードカード一覧 */}
      {keywords.map((kw) => {
        const urlRanks = getUrlRankInfo(kw.id, kw.trackedUrls);
        const negativeUrls = urlRanks.filter((u) => u.type === "negative");
        const history = rankingData.get(kw.id) || [];

        return (
          <div
            key={kw.id}
            className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 overflow-hidden"
          >
            {/* カードヘッダー */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-navy-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold">{kw.keyword}</h2>
                {!kw.isActive && (
                  <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">
                    監視OFF
                  </span>
                )}
                {kw.memo && (
                  <span className="text-xs text-gray-400">{kw.memo}</span>
                )}
              </div>
              <button
                onClick={() => measureRanking(kw.id)}
                disabled={measuring === kw.id}
                className="px-3 py-1.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-navy-950 rounded-md text-xs font-medium transition-colors"
              >
                {measuring === kw.id ? "計測中..." : "今すぐ計測"}
              </button>
            </div>

            {/* ネガティブURL最新順位 */}
            {negativeUrls.length > 0 && (
              <div className="px-6 py-4 border-b border-gray-100 dark:border-navy-800">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                  ネガティブURL順位
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {negativeUrls.map((u) => (
                    <div
                      key={u.url}
                      className="flex items-center justify-between bg-gray-50 dark:bg-navy-950 rounded-lg p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {u.label || new URL(u.url).hostname}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {u.url}
                        </p>
                      </div>
                      <div className="ml-3 flex items-center gap-2">
                        {u.latestRank !== null ? (
                          <>
                            <RankBadge rank={u.latestRank} />
                            {u.previousRank !== null && (
                              <span
                                className={`text-xs font-medium ${
                                  u.previousRank - u.latestRank > 0
                                    ? "text-green-500"
                                    : u.previousRank - u.latestRank < 0
                                    ? "text-red-500"
                                    : "text-gray-400"
                                }`}
                              >
                                {u.previousRank - u.latestRank > 0
                                  ? `↑${u.previousRank - u.latestRank}`
                                  : u.previousRank - u.latestRank < 0
                                  ? `↓${Math.abs(u.previousRank - u.latestRank)}`
                                  : "→"}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">未計測</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 順位推移グラフ */}
            {history.length > 0 && (
              <div className="px-6 py-4">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                  順位推移
                </h3>
                <RankingChart history={history} urls={kw.trackedUrls} />
              </div>
            )}

            {/* URLが未登録の場合 */}
            {kw.trackedUrls.length === 0 && (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-gray-400 mb-2">
                  URLが登録されていません
                </p>
                <Link
                  href="/urls"
                  className="text-sm text-accent-500 hover:text-accent-400"
                >
                  URLを登録する →
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

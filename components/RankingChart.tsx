"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { RankingHistory, TrackedUrl } from "@/lib/schema";

// 期間切り替えの型
type Period = "daily" | "weekly" | "monthly" | "yearly";

interface RankingChartProps {
  history: RankingHistory[];
  urls: TrackedUrl[];
}

// URLごとの色を生成
const NEGATIVE_COLORS = ["#ef4444", "#dc2626", "#b91c1c", "#991b1b"];
const POSITIVE_COLORS = ["#3b82f6", "#2563eb", "#1d4ed8", "#1e40af"];

// 期間ラベル
const PERIOD_LABELS: Record<Period, string> = {
  daily: "日別",
  weekly: "週別",
  monthly: "月別",
  yearly: "年別",
};

// 週番号を取得するヘルパー（ISO 8601 ベース）
function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // 月曜始まりに調整
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

// 週のラベルを表示用に整形
function formatWeekLabel(weekKey: string): string {
  // "2025-W10" → "2025 W10"
  return weekKey.replace("-", " ");
}

export function RankingChart({ history, urls }: RankingChartProps) {
  const [period, setPeriod] = useState<Period>("daily");

  // URLのラベルマップ作成
  const urlLabelMap = useMemo(() => {
    const map = new Map<string, { label: string; type: string }>();
    urls.forEach((u) => {
      const shortUrl =
        u.label || new URL(u.url).hostname.replace("www.", "");
      map.set(u.url, { label: shortUrl, type: u.type });
    });
    return map;
  }, [urls]);

  // 期間に応じたグルーピングキーを生成
  const getGroupKey = (date: Date): string => {
    switch (period) {
      case "daily":
        return date.toLocaleDateString("ja-JP", {
          month: "short",
          day: "numeric",
        });
      case "weekly":
        return getWeekKey(date);
      case "monthly":
        return date.toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "short",
        });
      case "yearly":
        return date.getFullYear().toString() + "年";
    }
  };

  // ソート用のタイムスタンプキーを取得
  const getSortKey = (date: Date): number => {
    switch (period) {
      case "daily":
        return new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        ).getTime();
      case "weekly": {
        const d = new Date(date);
        const dayNum = d.getDay() || 7;
        d.setDate(d.getDate() - dayNum + 1); // 月曜日に揃える
        return d.getTime();
      }
      case "monthly":
        return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      case "yearly":
        return new Date(date.getFullYear(), 0, 1).getTime();
    }
  };

  // 期間でグルーピングしたチャートデータを作成
  const chartData = useMemo(() => {
    if (history.length === 0) return [];

    // グループキー → { url → rank[] } のマップ
    const groupMap = new Map<
      string,
      { sortKey: number; ranks: Map<string, number[]> }
    >();

    history.forEach((record) => {
      const date = new Date(record.checkedAt);
      const key = getGroupKey(date);
      const sortKey = getSortKey(date);

      if (!groupMap.has(key)) {
        groupMap.set(key, { sortKey, ranks: new Map() });
      }

      const group = groupMap.get(key)!;
      if (!group.ranks.has(record.url)) {
        group.ranks.set(record.url, []);
      }
      group.ranks.get(record.url)!.push(record.rank);
    });

    // 各グループの平均順位を計算してチャートデータに変換
    const data = Array.from(groupMap.entries()).map(
      ([key, { sortKey, ranks }]) => {
        const entry: Record<string, string | number> = {
          date: period === "weekly" ? formatWeekLabel(key) : key,
          _sortKey: sortKey,
        };

        ranks.forEach((rankValues, url) => {
          // 期間内の平均順位（小数点以下四捨五入）
          const avg = Math.round(
            rankValues.reduce((a, b) => a + b, 0) / rankValues.length
          );
          entry[url] = avg;
        });

        return entry;
      }
    );

    // 古い順にソート
    data.sort(
      (a, b) => (a._sortKey as number) - (b._sortKey as number)
    );

    return data;
  }, [history, period]);

  // ユニークなURLリスト
  const uniqueUrls = useMemo(
    () => Array.from(new Set(history.map((h) => h.url))),
    [history]
  );

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        順位データがありません
      </div>
    );
  }

  // データ数に応じてチャート幅を計算（スマホ横スクロール用）
  // 各データポイントに最低80pxの幅を確保
  const MIN_POINT_WIDTH = 80;
  const chartWidth = Math.max(chartData.length * MIN_POINT_WIDTH, 400);

  // 色割り当て用のカウンター（毎レンダー時にリセット）
  let negativeIdx = 0;
  let positiveIdx = 0;

  return (
    <div className="space-y-3">
      {/* 期間切り替えタブ */}
      <div className="flex gap-1 bg-gray-100 dark:bg-navy-800 rounded-lg p-1 w-fit">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              period === p
                ? "bg-accent-500 text-navy-950 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* スクロール可能なグラフエリア */}
      <div className="overflow-x-auto -mx-2 px-2 pb-2">
        <div style={{ minWidth: `${chartWidth}px` }}>
          <LineChart
            width={chartWidth}
            height={400}
            data={chartData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              fontSize={12}
              tick={{ fill: "#9ca3af" }}
              interval={0}
              angle={chartData.length > 10 ? -30 : 0}
              textAnchor={chartData.length > 10 ? "end" : "middle"}
              height={chartData.length > 10 ? 60 : 30}
            />
            <YAxis
              reversed={true}
              domain={[1, 101]}
              stroke="#9ca3af"
              fontSize={12}
              width={45}
              label={{
                value: "順位",
                angle: -90,
                position: "insideLeft",
                style: { fill: "#9ca3af" },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                color: "#f3f4f6",
              }}
              formatter={(value: number, name: string) => {
                const info = urlLabelMap.get(name);
                const label = info?.label || name;
                const suffix =
                  period !== "daily" ? "（平均）" : "";
                return [
                  value === 101 ? "圏外" : `${value}位${suffix}`,
                  label,
                ];
              }}
            />
            <Legend
              formatter={(value: string) => {
                const info = urlLabelMap.get(value);
                return info?.label || value;
              }}
              wrapperStyle={{ fontSize: "12px" }}
            />
            {uniqueUrls.map((url) => {
              const info = urlLabelMap.get(url);
              const isNegative = info?.type === "negative";
              const color = isNegative
                ? NEGATIVE_COLORS[negativeIdx++ % NEGATIVE_COLORS.length]
                : POSITIVE_COLORS[positiveIdx++ % POSITIVE_COLORS.length];

              return (
                <Line
                  key={url}
                  type="monotone"
                  dataKey={url}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </div>
      </div>

      {/* スクロールヒント（データが多いとき） */}
      {chartData.length > 5 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 sm:hidden text-center">
          ← 横にスクロールして日付を確認 →
        </p>
      )}
    </div>
  );
}

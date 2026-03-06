"use client";

// URL種別（ネガティブ/ポジティブ）のバッジコンポーネント
export function UrlTypeBadge({ type }: { type: "negative" | "positive" }) {
  const isNegative = type === "negative";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isNegative
          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      }`}
    >
      {isNegative ? "ネガティブ" : "ポジティブ"}
    </span>
  );
}

// 順位に応じた色分けバッジ
export function RankBadge({ rank }: { rank: number }) {
  let colorClass: string;
  let label: string;

  if (rank >= 1 && rank <= 10) {
    // 1〜10位: 赤（危険）
    colorClass =
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    label = `${rank}位`;
  } else if (rank >= 11 && rank <= 30) {
    // 11〜30位: 黄（注意）
    colorClass =
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    label = `${rank}位`;
  } else if (rank <= 100) {
    // 31〜100位: 緑（安全）
    colorClass =
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    label = `${rank}位`;
  } else {
    // 101（圏外）
    colorClass =
      "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    label = "圏外";
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${colorClass}`}
    >
      {label}
    </span>
  );
}

// 前回比較（↑↓）表示
export function RankChange({
  current,
  previous,
}: {
  current: number;
  previous: number | null;
}) {
  if (previous === null) {
    return <span className="text-gray-400 text-xs">-</span>;
  }

  const diff = previous - current; // 順位が下がった=数値が上がった=改善

  if (diff > 0) {
    // 順位が改善（数値が小さくなった）
    return (
      <span className="text-green-600 dark:text-green-400 text-xs font-medium">
        ↑{diff}
      </span>
    );
  } else if (diff < 0) {
    // 順位が悪化（数値が大きくなった）
    return (
      <span className="text-red-600 dark:text-red-400 text-xs font-medium">
        ↓{Math.abs(diff)}
      </span>
    );
  } else {
    return (
      <span className="text-gray-400 dark:text-gray-500 text-xs">→</span>
    );
  }
}

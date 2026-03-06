"use client";

import type { PublishLog } from "@/lib/schema";

// プラットフォーム表示名
const PLATFORM_NAMES: Record<string, string> = {
  note: "note",
  ameblo: "アメブロ",
  linkedin: "LinkedIn",
  x: "X (Twitter)",
  facebook: "Facebook",
  instagram: "Instagram",
  wordpress: "WordPress",
};

// ステータスの表示設定
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  success: {
    label: "成功",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  failed: {
    label: "失敗",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  pending: {
    label: "待機中",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  manual: {
    label: "手動投稿",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
};

interface PublishStatusCardProps {
  log: PublishLog;
}

export function PublishStatusCard({ log }: PublishStatusCardProps) {
  const statusConfig = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
  const platformName = PLATFORM_NAMES[log.platform] || log.platform;

  return (
    <div className="px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium min-w-[100px]">
          {platformName}
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}
        >
          {statusConfig.label}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {log.publishedUrl && (
          <a
            href={log.publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent-500 hover:text-accent-400"
          >
            投稿を見る →
          </a>
        )}
        {log.errorMessage && (
          <span className="text-xs text-red-400 max-w-xs truncate" title={log.errorMessage}>
            {log.errorMessage}
          </span>
        )}
        <span className="text-xs text-gray-400">
          {new Date(log.publishedAt).toLocaleString("ja-JP")}
        </span>
      </div>
    </div>
  );
}

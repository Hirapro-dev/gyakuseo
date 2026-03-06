"use client";

import { useState } from "react";
import type { RewrittenArticle } from "@/lib/schema";

// プラットフォーム表示名
const PLATFORM_NAMES: Record<string, string> = {
  note: "note",
  ameblo: "アメブロ",
  linkedin: "LinkedIn",
  x: "X (Twitter)",
  facebook: "Facebook",
  instagram: "Instagram",
};

// 自動投稿可能なプラットフォーム
const AUTO_PUBLISH_PLATFORMS = ["wordpress", "x", "facebook", "instagram"];

// コピペ補助のプラットフォーム
const MANUAL_PLATFORMS = ["note", "ameblo", "linkedin"];

interface RewritePanelProps {
  rewrittenArticles: RewrittenArticle[];
  articleId: number;
  onPublished: () => void;
}

export function RewritePanel({
  rewrittenArticles,
  articleId,
  onPublished,
}: RewritePanelProps) {
  const [activeTab, setActiveTab] = useState(
    rewrittenArticles[0]?.platform || "note"
  );
  const [copied, setCopied] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  const activeArticle = rewrittenArticles.find(
    (r) => r.platform === activeTab
  );

  // クリップボードにコピー
  const handleCopy = async (text: string, platform: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(platform);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      alert("コピーに失敗しました");
    }
  };

  // 自動投稿実行
  const handleAutoPublish = async (platform: string) => {
    setPublishing(platform);
    try {
      const res = await fetch(`/api/publish/${platform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });

      if (res.ok) {
        onPublished();
      } else {
        const error = await res.json();
        alert(`投稿エラー: ${error.error}`);
      }
    } catch {
      alert("投稿に失敗しました");
    } finally {
      setPublishing(null);
    }
  };

  // 手動投稿済みを記録
  const handleManualDone = async (platform: string) => {
    try {
      const res = await fetch(`/api/publish/${platform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, manual: true }),
      });

      if (res.ok) {
        onPublished();
      }
    } catch {
      console.error("手動投稿記録エラー");
    }
  };

  // フルテキスト（タイトル + 本文 + ハッシュタグ）を生成
  const getFullText = (article: RewrittenArticle) => {
    let text = "";
    if (article.rewrittenTitle) text += article.rewrittenTitle + "\n\n";
    text += article.rewrittenBody;
    if (article.hashtags) text += "\n\n" + article.hashtags;
    return text;
  };

  return (
    <div>
      {/* プラットフォームタブ */}
      <div className="flex overflow-x-auto border-b border-gray-200 dark:border-navy-700">
        {rewrittenArticles.map((r) => (
          <button
            key={r.platform}
            onClick={() => setActiveTab(r.platform)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === r.platform
                ? "border-accent-500 text-accent-500"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {PLATFORM_NAMES[r.platform] || r.platform}
          </button>
        ))}
      </div>

      {/* リライト内容表示 */}
      {activeArticle && (
        <div className="p-6 space-y-4">
          {/* タイトル */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              タイトル
            </h4>
            <p className="text-sm font-medium">{activeArticle.rewrittenTitle}</p>
          </div>

          {/* 本文 */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              本文
            </h4>
            <div className="text-sm whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-navy-950 rounded-lg p-4 max-h-64 overflow-y-auto">
              {activeArticle.rewrittenBody}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {activeArticle.rewrittenBody.length}文字
            </p>
          </div>

          {/* ハッシュタグ */}
          {activeArticle.hashtags && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                ハッシュタグ
              </h4>
              <p className="text-sm text-accent-500">{activeArticle.hashtags}</p>
            </div>
          )}

          {/* アクションボタン */}
          <div className="flex flex-wrap gap-2 pt-2">
            {/* コピーボタン（全プラットフォーム共通） */}
            <button
              onClick={() =>
                handleCopy(getFullText(activeArticle), activeArticle.platform)
              }
              className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-navy-950 rounded-lg text-sm font-medium transition-colors"
            >
              {copied === activeArticle.platform
                ? "コピーしました！"
                : "テキストをコピー"}
            </button>

            {/* 自動投稿ボタン（対応プラットフォームのみ） */}
            {AUTO_PUBLISH_PLATFORMS.includes(activeArticle.platform) && (
              <button
                onClick={() => handleAutoPublish(activeArticle.platform)}
                disabled={publishing === activeArticle.platform}
                className="px-4 py-2 bg-navy-700 hover:bg-navy-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {publishing === activeArticle.platform
                  ? "投稿中..."
                  : `${PLATFORM_NAMES[activeArticle.platform]}に投稿`}
              </button>
            )}

            {/* 手動投稿済みボタン（コピペ補助プラットフォーム） */}
            {MANUAL_PLATFORMS.includes(activeArticle.platform) && (
              <button
                onClick={() => handleManualDone(activeArticle.platform)}
                className="px-4 py-2 border border-gray-300 dark:border-navy-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 rounded-lg text-sm font-medium transition-colors"
              >
                手動投稿済みにする
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

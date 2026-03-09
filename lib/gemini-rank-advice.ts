import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ScrapedPageContent } from "./scraper";

// 順位履歴データの型
interface RankHistoryEntry {
  rank: number;
  checkedAt: string;
}

// 競合ページ情報の型
interface CompetitorInfo {
  position: number;
  title: string;
  url: string;
  snippet?: string;
  sentiment?: string;
}

// AI分析結果の型
export interface RankAnalysisResult {
  trend: "up" | "down" | "stable" | "new"; // 順位トレンド
  reason: string; // 変動理由の推測
  advice: string; // 改善アドバイス
  urgency: "high" | "medium" | "low"; // 緊急度
}

/**
 * Gemini AIで順位変動の理由を推測し、改善アドバイスを生成する
 * gemini-2.0-flashを使用（高速・安定）
 */
export async function analyzeRankChange(params: {
  keyword: string;
  url: string;
  siteName: string;
  rankHistory: RankHistoryEntry[];
  scrapedContent: ScrapedPageContent | null;
  competitors: CompetitorInfo[];
  domainArticles?: { url: string; rank: number; title?: string }[];
}): Promise<RankAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("環境変数 GEMINI_API_KEY が設定されていません");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // 順位変動トレンドを計算
  const sorted = [...params.rankHistory].sort(
    (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
  );
  const latestRank = sorted[0]?.rank ?? null;
  const previousRank = sorted[1]?.rank ?? null;

  let trendLabel = "データ不足";
  if (latestRank !== null && previousRank !== null) {
    if (latestRank < previousRank) trendLabel = `上昇（${previousRank}位→${latestRank}位）`;
    else if (latestRank > previousRank) trendLabel = `下降（${previousRank}位→${latestRank}位）`;
    else trendLabel = `横ばい（${latestRank}位を維持）`;
  } else if (latestRank !== null) {
    trendLabel = `初回計測（${latestRank}位）`;
  }

  // 直近の順位推移テキスト
  const historyText = sorted
    .slice(0, 10)
    .map((h) => {
      try {
        return `${new Date(h.checkedAt).toLocaleDateString("ja-JP")}: ${h.rank === 101 ? "圏外" : h.rank + "位"}`;
      } catch {
        return `日付不明: ${h.rank === 101 ? "圏外" : h.rank + "位"}`;
      }
    })
    .join("\n");

  // 自社ページの情報テキスト
  let pageInfoText = "※ページ内容を取得できませんでした";
  if (params.scrapedContent) {
    const sc = params.scrapedContent;
    pageInfoText = `タイトル: ${sc.title || "不明"}
説明: ${sc.description || "なし"}
見出し: ${sc.headings.slice(0, 8).join(" / ") || "なし"}
本文（抜粋）: ${(sc.bodyText || "").slice(0, 600)}`;
  }

  // 競合情報テキスト（最大5件に絞る）
  const competitorText = params.competitors.length > 0
    ? params.competitors
        .slice(0, 5)
        .map((c) => `${c.position}位: ${c.title}\n   URL: ${c.url}`)
        .join("\n\n")
    : "競合データなし";

  // 同一ドメインの複数記事情報
  const domainArticlesText = params.domainArticles && params.domainArticles.length > 1
    ? `\n## 同一ドメインの他の記事（${params.domainArticles.length}件）\n${params.domainArticles.map((a) => `- ${a.rank}位: ${a.title || a.url}`).join("\n")}`
    : "";

  const prompt = `あなたは逆SEO・検索順位最適化の専門家です。

以下の情報を分析し、順位変動の理由推測と改善アドバイスをJSON形式で返してください。

## 基本情報
- キーワード: 「${params.keyword}」
- 対象サイト: ${params.siteName}
- 対象URL: ${params.url}
- 順位トレンド: ${trendLabel}

## 直近の順位推移
${historyText || "データなし"}

## 対象ページの内容
${pageInfoText}

## 検索結果の競合状況
${competitorText}
${domainArticlesText}

以下のJSON形式で返してください。JSONのみ返してください。

{"trend":"up/down/stable/newのいずれか","reason":"変動理由の推測（200文字程度）","advice":"改善アドバイス（200文字程度）","urgency":"high/medium/lowのいずれか"}`;

  // gemini-2.5-proを優先、失敗時はgemini-2.5-flashにフォールバック
  const models = ["gemini-2.5-pro", "gemini-2.5-flash"];

  for (const modelName of models) {
    try {
      console.log(`Geminiモデル ${modelName} で分析開始...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // JSONパース
      const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed: RankAnalysisResult = JSON.parse(jsonStr);

      return {
        trend: ["up", "down", "stable", "new"].includes(parsed.trend) ? parsed.trend : "stable",
        reason: parsed.reason || "分析データが不足しています",
        advice: parsed.advice || "順位データの蓄積をお待ちください",
        urgency: ["high", "medium", "low"].includes(parsed.urgency) ? parsed.urgency : "medium",
      };
    } catch (error) {
      console.error(`Geminiモデル ${modelName} でエラー:`, error instanceof Error ? error.message : error);
      // 次のモデルを試す
      continue;
    }
  }

  // 全モデル失敗時のフォールバック結果
  // 順位データからトレンドだけは自力で判定
  let fallbackTrend: "up" | "down" | "stable" | "new" = "stable";
  let fallbackUrgency: "high" | "medium" | "low" = "medium";

  if (latestRank === null) {
    fallbackTrend = "new";
  } else if (previousRank !== null) {
    if (latestRank < previousRank) fallbackTrend = "up";
    else if (latestRank > previousRank) fallbackTrend = "down";
  }
  if (latestRank !== null && latestRank > 50) fallbackUrgency = "high";
  if (latestRank !== null && latestRank <= 10) fallbackUrgency = "low";

  return {
    trend: fallbackTrend,
    reason: `現在${latestRank !== null ? latestRank + "位" : "順位データなし"}です。AI分析サービスに一時的に接続できませんでした。順位データの蓄積が増えると、より精度の高い分析が可能になります。`,
    advice: "定期的にコンテンツを更新し、関連キーワードを含む質の高い記事を投稿してください。SNS連携やGoogleビジネスプロフィールの充実も効果的です。",
    urgency: fallbackUrgency,
  };
}

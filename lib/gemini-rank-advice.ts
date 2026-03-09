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
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
    .map((h) => `${new Date(h.checkedAt).toLocaleDateString("ja-JP")}: ${h.rank === 101 ? "圏外" : h.rank + "位"}`)
    .join("\n");

  // 自社ページの情報テキスト
  let pageInfoText = "※ページ内容を取得できませんでした";
  if (params.scrapedContent) {
    const sc = params.scrapedContent;
    pageInfoText = `タイトル: ${sc.title}
説明: ${sc.description || "なし"}
見出し: ${sc.headings.slice(0, 8).join(" / ") || "なし"}
本文（抜粋）: ${sc.bodyText.slice(0, 800)}`;
  }

  // 競合情報テキスト
  const competitorText = params.competitors.length > 0
    ? params.competitors
        .slice(0, 10)
        .map((c) => `${c.position}位: ${c.title}\n   URL: ${c.url}\n   概要: ${c.snippet || "なし"}`)
        .join("\n\n")
    : "競合データなし";

  // 同一ドメインの複数記事情報
  const domainArticlesText = params.domainArticles && params.domainArticles.length > 1
    ? `\n## 同一ドメインの他の記事（${params.domainArticles.length}件）\n${params.domainArticles.map((a) => `- ${a.rank}位: ${a.title || a.url}`).join("\n")}`
    : "";

  const prompt = `あなたは逆SEO・検索順位最適化の日本市場トップクラスの専門家です。

以下の情報を分析し、この自社ページの順位変動の理由を推測し、順位を改善するための具体的なアドバイスを提供してください。

## 基本情報
- キーワード: 「${params.keyword}」
- 対象サイト: ${params.siteName}
- 対象URL: ${params.url}
- 順位トレンド: ${trendLabel}

## 直近の順位推移
${historyText || "データなし"}

## 対象ページの内容
${pageInfoText}

## 検索結果の競合状況（上位ページ）
${competitorText}
${domainArticlesText}

## 出力形式
以下のJSON形式で**1件**を返してください。説明やマークダウンは不要で、有効なJSONのみ返してください。

{
  "trend": "up/down/stable/newのいずれか",
  "reason": "順位が変動した（または安定している）理由の推測。200〜500文字程度で具体的に。競合との比較、コンテンツの強み・弱み、検索意図との一致度などを踏まえて分析してください。",
  "advice": "順位をさらに上げる（または維持する）ための具体的なアドバイス。200〜500文字程度で、何を・どこで・どうするかを明確に。コンテンツ追加/修正の具体案、更新頻度、内部リンク、SNS連携、被リンク獲得などの施策を含めてください。",
  "urgency": "high/medium/lowのいずれか（圏外や大幅下降ならhigh、微減ならmedium、上昇・安定ならlow）"
}

注意:
- 逆SEOの文脈（ネガティブ記事を押し下げてポジティブコンテンツを上位表示させたい）で分析してください
- 日本語の検索エンジン最適化の最新知見に基づいてください
- 推測が難しい部分は「〜の可能性があります」のように断定を避けてください`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  // JSONパース
  const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const parsed: RankAnalysisResult = JSON.parse(jsonStr);
    return {
      trend: ["up", "down", "stable", "new"].includes(parsed.trend) ? parsed.trend : "stable",
      reason: parsed.reason,
      advice: parsed.advice,
      urgency: ["high", "medium", "low"].includes(parsed.urgency) ? parsed.urgency : "medium",
    };
  } catch (error) {
    console.error("Geminiレスポンスのパースエラー:", error);
    console.error("レスポンス:", text);
    throw new Error("AIの応答を解析できませんでした");
  }
}

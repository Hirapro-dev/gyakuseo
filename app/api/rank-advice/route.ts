import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rankingHistory, searchResults, keywords, ownedSites } from "@/lib/schema";
import { eq, desc, and, gte, lt } from "drizzle-orm";
import { analyzeRankChange } from "@/lib/gemini-rank-advice";
import { scrapePageContent } from "@/lib/scraper";

// 本日の0時（JST）を取得
function getTodayStartJST(): Date {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const jstToday = new Date(
    jstNow.getFullYear(),
    jstNow.getMonth(),
    jstNow.getDate()
  );
  return new Date(jstToday.getTime() - jstOffset);
}

// POST: 順位変動分析+アドバイス生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ownedSiteId, keywordId } = body;

    if (!ownedSiteId || !keywordId) {
      return NextResponse.json(
        { error: "ownedSiteIdとkeywordIdは必須です" },
        { status: 400 }
      );
    }

    console.log(`[rank-advice] 開始: siteId=${ownedSiteId}, kwId=${keywordId}`);

    // 自社サイト情報を取得
    const site = await db.query.ownedSites.findFirst({
      where: eq(ownedSites.id, ownedSiteId),
    });
    if (!site) {
      return NextResponse.json(
        { error: "サイトが見つかりません" },
        { status: 404 }
      );
    }
    console.log(`[rank-advice] サイト取得OK: ${site.serviceName}`);

    // キーワード情報を取得
    const kw = await db.query.keywords.findFirst({
      where: eq(keywords.id, keywordId),
    });
    if (!kw) {
      return NextResponse.json(
        { error: "キーワードが見つかりません" },
        { status: 404 }
      );
    }
    console.log(`[rank-advice] キーワード取得OK: ${kw.keyword}`);

    // ドメインを抽出
    let siteDomain: string;
    try {
      siteDomain = new URL(site.pageUrl).hostname.replace(/^www\./, "");
    } catch {
      siteDomain = site.pageUrl;
    }

    // 順位履歴取得
    let allHistory: { id: number; keywordId: number; url: string; rank: number; checkedAt: Date }[] = [];
    try {
      allHistory = await db.query.rankingHistory.findMany({
        where: eq(rankingHistory.keywordId, keywordId),
        orderBy: [desc(rankingHistory.checkedAt)],
        limit: 200,
      });
      console.log(`[rank-advice] 順位履歴: ${allHistory.length}件`);
    } catch (e) {
      console.error("[rank-advice] 順位履歴取得エラー:", e);
    }

    // 同一ドメインのURLをフィルタ
    const domainHistory = allHistory.filter((h) => {
      try {
        return new URL(h.url).hostname.replace(/^www\./, "") === siteDomain;
      } catch {
        return false;
      }
    });
    console.log(`[rank-advice] ドメイン一致: ${domainHistory.length}件`);

    // URL単位でグループ化、最新順位を取得
    const latestByUrl = new Map<string, (typeof domainHistory)[0]>();
    domainHistory.forEach((h) => {
      const existing = latestByUrl.get(h.url);
      if (
        !existing ||
        new Date(h.checkedAt).getTime() > new Date(existing.checkedAt).getTime()
      ) {
        latestByUrl.set(h.url, h);
      }
    });

    // ドメイン内の全記事とその順位
    const domainArticles = Array.from(latestByUrl.entries())
      .filter(([, h]) => h.rank <= 100)
      .map(([url, h]) => ({ url, rank: h.rank }))
      .sort((a, b) => a.rank - b.rank);

    // 最高位のURLの順位履歴を取得
    const bestUrl = domainArticles[0]?.url || site.pageUrl;
    console.log(`[rank-advice] 分析対象URL: ${bestUrl}`);

    const urlHistory = domainHistory
      .filter((h) => h.url === bestUrl)
      .sort(
        (a, b) =>
          new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
      )
      .slice(0, 20)
      .map((h) => ({
        rank: h.rank,
        checkedAt:
          h.checkedAt instanceof Date
            ? h.checkedAt.toISOString()
            : String(h.checkedAt),
      }));

    // 対象ページのスクレイピング
    let scrapedContent = null;
    try {
      scrapedContent = await scrapePageContent(bestUrl);
      console.log(`[rank-advice] スクレイピング: ${scrapedContent ? "OK" : "null"}`);
    } catch (e) {
      console.error("[rank-advice] スクレイピングエラー:", e);
    }

    // 当日の検索結果（競合情報）を取得
    const todayStart = getTodayStartJST();
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    let competitors: {
      position: number;
      title: string;
      url: string;
      snippet: string | null;
      sentiment: string;
    }[] = [];
    try {
      competitors = await db
        .select()
        .from(searchResults)
        .where(
          and(
            eq(searchResults.keywordId, keywordId),
            gte(searchResults.checkedAt, todayStart),
            lt(searchResults.checkedAt, todayEnd)
          )
        )
        .orderBy(searchResults.position);
      console.log(`[rank-advice] 競合データ: ${competitors.length}件`);
    } catch (e) {
      console.error("[rank-advice] 競合データ取得エラー:", e);
    }

    // Gemini AIで分析
    console.log("[rank-advice] Gemini AI分析開始...");
    const analysis = await analyzeRankChange({
      keyword: kw.keyword,
      url: bestUrl,
      siteName: site.serviceName,
      rankHistory: urlHistory,
      scrapedContent,
      competitors: competitors.map((c) => ({
        position: c.position,
        title: c.title,
        url: c.url,
        snippet: c.snippet || undefined,
        sentiment: c.sentiment,
      })),
      domainArticles,
    });
    console.log("[rank-advice] 分析完了:", analysis.trend);

    return NextResponse.json({
      ...analysis,
      keyword: kw.keyword,
      siteName: site.serviceName,
      url: bestUrl,
      domainArticleCount: domainArticles.length,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const errorStack =
      error instanceof Error ? error.stack : undefined;
    console.error("順位分析エラー:", errorMessage);
    if (errorStack) console.error("スタック:", errorStack);
    return NextResponse.json(
      { error: "順位分析に失敗しました", detail: errorMessage },
      { status: 500 }
    );
  }
}

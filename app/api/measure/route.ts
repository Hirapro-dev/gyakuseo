import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { keywords, trackedUrls, rankingHistory } from "@/lib/schema";
import { eq, and, gte } from "drizzle-orm";
import { getSearchRankings } from "@/lib/google-search";

// 本日の0時（JST）を取得
function getTodayStartJST(): Date {
  const now = new Date();
  // JSTオフセット（+9時間）
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const jstToday = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());
  // UTCに戻す
  return new Date(jstToday.getTime() - jstOffset);
}

// 手動計測エンドポイント
// 当日既に計測済みならキャッシュ（DB）から返す
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywordId } = body;

    // 計測対象のキーワードを取得
    let targetKeywords;
    if (keywordId) {
      targetKeywords = await db.query.keywords.findMany({
        where: eq(keywords.id, keywordId),
      });
    } else {
      targetKeywords = await db.query.keywords.findMany({
        where: eq(keywords.isActive, true),
      });
    }

    if (targetKeywords.length === 0) {
      return NextResponse.json(
        { error: "計測対象のキーワードがありません" },
        { status: 404 }
      );
    }

    const todayStart = getTodayStartJST();
    let totalProcessed = 0;
    let cachedCount = 0;
    const results: { keyword: string; urlCount: number; cached: boolean; error?: string }[] = [];

    for (const kw of targetKeywords) {
      try {
        // キーワードに紐づくURLを取得
        const urls = await db.query.trackedUrls.findMany({
          where: eq(trackedUrls.keywordId, kw.id),
        });

        if (urls.length === 0) {
          results.push({ keyword: kw.keyword, urlCount: 0, cached: false });
          continue;
        }

        // 当日の計測データがあるかチェック
        const todayHistory = await db.query.rankingHistory.findMany({
          where: and(
            eq(rankingHistory.keywordId, kw.id),
            gte(rankingHistory.checkedAt, todayStart)
          ),
        });

        if (todayHistory.length > 0) {
          // 当日キャッシュあり → SerpAPI呼ばない
          totalProcessed += todayHistory.length;
          cachedCount += todayHistory.length;
          results.push({ keyword: kw.keyword, urlCount: todayHistory.length, cached: true });
          continue;
        }

        // キャッシュなし → SerpAPIで計測
        const targetUrls = urls.map((u) => u.url);
        const rankings = await getSearchRankings(kw.keyword, targetUrls);

        const now = new Date();
        const insertData = rankings.map((r) => ({
          keywordId: kw.id,
          url: r.url,
          rank: r.rank,
          checkedAt: now,
        }));

        await db.insert(rankingHistory).values(insertData);

        totalProcessed += rankings.length;
        results.push({ keyword: kw.keyword, urlCount: rankings.length, cached: false });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ keyword: kw.keyword, urlCount: 0, cached: false, error: errorMsg });
      }
    }

    return NextResponse.json({
      message: cachedCount > 0
        ? `計測完了（${cachedCount}件はキャッシュ利用）`
        : "計測が完了しました",
      processed: totalProcessed,
      cached: cachedCount,
      results,
    });
  } catch (error) {
    console.error("手動計測エラー:", error);
    return NextResponse.json(
      { error: "計測に失敗しました" },
      { status: 500 }
    );
  }
}

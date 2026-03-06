import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { keywords, trackedUrls, rankingHistory } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSearchRankings } from "@/lib/google-search";

// 手動計測エンドポイント
// keywordId指定で特定キーワードのみ、指定なしで全キーワードを計測
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywordId } = body;

    // 計測対象のキーワードを取得
    let targetKeywords;
    if (keywordId) {
      // 特定のキーワードのみ
      targetKeywords = await db.query.keywords.findMany({
        where: eq(keywords.id, keywordId),
      });
    } else {
      // 全アクティブキーワード
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

    let totalProcessed = 0;
    const results: { keyword: string; urlCount: number; error?: string }[] = [];

    for (const kw of targetKeywords) {
      try {
        // キーワードに紐づくURLを取得
        const urls = await db.query.trackedUrls.findMany({
          where: eq(trackedUrls.keywordId, kw.id),
        });

        if (urls.length === 0) {
          results.push({ keyword: kw.keyword, urlCount: 0 });
          continue;
        }

        // Google検索APIで順位取得
        const targetUrls = urls.map((u) => u.url);
        const rankings = await getSearchRankings(kw.keyword, targetUrls);

        // 結果をDBに保存
        const now = new Date();
        const insertData = rankings.map((r) => ({
          keywordId: kw.id,
          url: r.url,
          rank: r.rank,
          checkedAt: now,
        }));

        await db.insert(rankingHistory).values(insertData);

        totalProcessed += rankings.length;
        results.push({ keyword: kw.keyword, urlCount: rankings.length });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ keyword: kw.keyword, urlCount: 0, error: errorMsg });
      }
    }

    return NextResponse.json({
      message: "計測が完了しました",
      processed: totalProcessed,
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

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rankingHistory, trackedUrls } from "@/lib/schema";
import { eq, desc, and } from "drizzle-orm";
import { getSearchRankings } from "@/lib/google-search";

// 順位履歴取得（キーワードIDでフィルタ）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get("keywordId");
    const limit = parseInt(searchParams.get("limit") || "30");

    if (!keywordId) {
      return NextResponse.json(
        { error: "keywordId は必須です" },
        { status: 400 }
      );
    }

    const history = await db.query.rankingHistory.findMany({
      where: eq(rankingHistory.keywordId, parseInt(keywordId)),
      orderBy: [desc(rankingHistory.checkedAt)],
      limit: limit,
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error("順位履歴取得エラー:", error);
    return NextResponse.json(
      { error: "順位履歴の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// 手動で順位を計測（特定キーワード）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywordId } = body;

    if (!keywordId) {
      return NextResponse.json(
        { error: "keywordId は必須です" },
        { status: 400 }
      );
    }

    // キーワードに紐づくURLを取得
    const urls = await db.query.trackedUrls.findMany({
      where: eq(trackedUrls.keywordId, keywordId),
    });

    if (urls.length === 0) {
      return NextResponse.json(
        { error: "このキーワードに登録されたURLがありません" },
        { status: 404 }
      );
    }

    // キーワード情報を取得
    const keyword = await db.query.keywords.findFirst({
      where: (keywords, { eq }) => eq(keywords.id, keywordId),
    });

    if (!keyword) {
      return NextResponse.json(
        { error: "キーワードが見つかりません" },
        { status: 404 }
      );
    }

    // Google検索APIで順位取得
    const targetUrls = urls.map((u) => u.url);
    const rankings = await getSearchRankings(keyword.keyword, targetUrls);

    // 結果をDBに保存
    const now = new Date();
    const insertData = rankings.map((r) => ({
      keywordId: keywordId,
      url: r.url,
      rank: r.rank,
      checkedAt: now,
    }));

    const saved = await db
      .insert(rankingHistory)
      .values(insertData)
      .returning();

    console.log(
      `順位計測完了: "${keyword.keyword}" - ${saved.length}件保存しました`
    );

    return NextResponse.json({
      message: "順位計測が完了しました",
      results: saved,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("順位計測エラー:", errorMessage);
    return NextResponse.json(
      { error: "順位計測に失敗しました", detail: errorMessage },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { keywords, searchResults } from "@/lib/schema";
import { eq, and, gte, lt, desc } from "drizzle-orm";
import { getAllSearchResults } from "@/lib/google-search";
import { detectNegativeArticles } from "@/lib/gemini-negative-detect";

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

// 指定日の0時（JST）を取得
function getDateStartJST(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(year, month - 1, day);
  return new Date(jstDate.getTime() - jstOffset);
}

// GET: 検索結果履歴取得（ネガティブ記事一覧）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get("keywordId");
    const dateStr = searchParams.get("date");
    const onlyNegative = searchParams.get("onlyNegative") === "true";

    if (!keywordId) {
      return NextResponse.json(
        { error: "keywordIdは必須です" },
        { status: 400 }
      );
    }

    const kwId = parseInt(keywordId);
    const dayStart = dateStr ? getDateStartJST(dateStr) : getTodayStartJST();
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    let results;
    if (onlyNegative) {
      results = await db
        .select()
        .from(searchResults)
        .where(
          and(
            eq(searchResults.keywordId, kwId),
            gte(searchResults.checkedAt, dayStart),
            lt(searchResults.checkedAt, dayEnd),
            eq(searchResults.sentiment, "negative")
          )
        )
        .orderBy(searchResults.position);
    } else {
      results = await db
        .select()
        .from(searchResults)
        .where(
          and(
            eq(searchResults.keywordId, kwId),
            gte(searchResults.checkedAt, dayStart),
            lt(searchResults.checkedAt, dayEnd)
          )
        )
        .orderBy(searchResults.position);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("検索結果取得エラー:", error);
    return NextResponse.json(
      { error: "検索結果の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: 検索結果取得 + ネガティブ判定実行（日次キャッシュ付き）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywordId } = body;

    // 対象キーワード取得
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
        { error: "対象のキーワードがありません" },
        { status: 404 }
      );
    }

    const todayStart = getTodayStartJST();
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const results: {
      keyword: string;
      totalCount: number;
      negativeCount: number;
      cached: boolean;
      error?: string;
    }[] = [];

    for (const kw of targetKeywords) {
      try {
        // 当日のキャッシュチェック
        const todayData = await db
          .select()
          .from(searchResults)
          .where(
            and(
              eq(searchResults.keywordId, kw.id),
              gte(searchResults.checkedAt, todayStart),
              lt(searchResults.checkedAt, todayEnd)
            )
          );

        if (todayData.length > 0) {
          const negCount = todayData.filter(
            (d) => d.sentiment === "negative"
          ).length;
          results.push({
            keyword: kw.keyword,
            totalCount: todayData.length,
            negativeCount: negCount,
            cached: true,
          });
          continue;
        }

        // SerpAPIから検索結果取得（上位30件）
        const serpResults = await getAllSearchResults(kw.keyword, 30);

        // Gemini AIでネガティブ判定
        const analyzed = await detectNegativeArticles(kw.keyword, serpResults);

        // DB保存
        const now = new Date();
        const insertData = analyzed.map((a) => ({
          keywordId: kw.id,
          position: a.position,
          title: a.title,
          url: a.url,
          snippet: a.snippet || null,
          sentiment: a.sentiment as
            | "negative"
            | "neutral"
            | "positive"
            | "unclassified",
          reason: a.reason,
          checkedAt: now,
        }));

        if (insertData.length > 0) {
          await db.insert(searchResults).values(insertData);
        }

        const negCount = analyzed.filter(
          (a) => a.sentiment === "negative"
        ).length;
        results.push({
          keyword: kw.keyword,
          totalCount: analyzed.length,
          negativeCount: negCount,
          cached: false,
        });
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        results.push({
          keyword: kw.keyword,
          totalCount: 0,
          negativeCount: 0,
          cached: false,
          error: errorMsg,
        });
      }
    }

    const totalNegative = results.reduce((sum, r) => sum + r.negativeCount, 0);
    const cachedCount = results.filter((r) => r.cached).length;

    return NextResponse.json({
      message:
        totalNegative > 0
          ? `分析完了: ${totalNegative}件のネガティブ記事を検出しました`
          : "分析完了: ネガティブ記事は検出されませんでした",
      results,
      cachedCount,
    });
  } catch (error) {
    console.error("ネガティブ記事検出エラー:", error);
    return NextResponse.json(
      { error: "ネガティブ記事の検出に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: 当日キャッシュリセット（再スキャン用）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get("keywordId");

    if (!keywordId) {
      return NextResponse.json(
        { error: "keywordIdは必須です" },
        { status: 400 }
      );
    }

    const kwId = parseInt(keywordId);
    const todayStart = getTodayStartJST();
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const deleted = await db
      .delete(searchResults)
      .where(
        and(
          eq(searchResults.keywordId, kwId),
          gte(searchResults.checkedAt, todayStart),
          lt(searchResults.checkedAt, todayEnd)
        )
      )
      .returning();

    return NextResponse.json({
      message: `${deleted.length}件のキャッシュを削除しました`,
      deletedCount: deleted.length,
    });
  } catch (error) {
    console.error("キャッシュ削除エラー:", error);
    return NextResponse.json(
      { error: "キャッシュの削除に失敗しました" },
      { status: 500 }
    );
  }
}

// PUT: sentiment手動変更
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, sentiment } = body;

    if (!id || !sentiment) {
      return NextResponse.json(
        { error: "idとsentimentは必須です" },
        { status: 400 }
      );
    }

    const validSentiments = ["negative", "neutral", "positive", "unclassified"];
    if (!validSentiments.includes(sentiment)) {
      return NextResponse.json(
        {
          error:
            "sentimentはnegative/neutral/positive/unclassifiedのいずれかです",
        },
        { status: 400 }
      );
    }

    const updated = await db
      .update(searchResults)
      .set({ sentiment })
      .where(eq(searchResults.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "レコードが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("sentiment更新エラー:", error);
    return NextResponse.json(
      { error: "sentimentの更新に失敗しました" },
      { status: 500 }
    );
  }
}

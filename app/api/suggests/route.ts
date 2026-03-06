import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { keywords, suggestHistory } from "@/lib/schema";
import { eq, and, gte, lt, desc } from "drizzle-orm";
import { getGoogleSuggestions } from "@/lib/google-suggest";

// 本日の0時（JST）を取得
function getTodayStartJST(): Date {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const jstToday = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());
  return new Date(jstToday.getTime() - jstOffset);
}

// 指定日の0時（JST）を取得
function getDateStartJST(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(year, month - 1, day);
  return new Date(jstDate.getTime() - jstOffset);
}

// GET: サジェスト履歴取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get("keywordId");
    const dateStr = searchParams.get("date"); // YYYY-MM-DD形式

    if (!keywordId) {
      return NextResponse.json(
        { error: "keywordIdは必須です" },
        { status: 400 }
      );
    }

    const kwId = parseInt(keywordId);
    const dayStart = dateStr ? getDateStartJST(dateStr) : getTodayStartJST();
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const history = await db
      .select()
      .from(suggestHistory)
      .where(
        and(
          eq(suggestHistory.keywordId, kwId),
          gte(suggestHistory.checkedAt, dayStart),
          lt(suggestHistory.checkedAt, dayEnd)
        )
      )
      .orderBy(suggestHistory.position);

    return NextResponse.json(history);
  } catch (error) {
    console.error("サジェスト履歴取得エラー:", error);
    return NextResponse.json(
      { error: "サジェスト履歴の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: サジェスト取得実行（日次キャッシュ付き）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywordId } = body;

    // 計測対象キーワードを取得
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
    const results: { keyword: string; count: number; cached: boolean; error?: string }[] = [];

    for (const kw of targetKeywords) {
      try {
        // 当日のキャッシュチェック
        const todayData = await db
          .select()
          .from(suggestHistory)
          .where(
            and(
              eq(suggestHistory.keywordId, kw.id),
              gte(suggestHistory.checkedAt, todayStart),
              lt(suggestHistory.checkedAt, todayEnd)
            )
          );

        if (todayData.length > 0) {
          results.push({ keyword: kw.keyword, count: todayData.length, cached: true });
          continue;
        }

        // SerpAPIからサジェスト取得
        const suggestions = await getGoogleSuggestions(kw.keyword);

        // 前回のsentiment分類を取得（同一テキストなら引き継ぐ）
        const prevData = await db
          .select()
          .from(suggestHistory)
          .where(eq(suggestHistory.keywordId, kw.id))
          .orderBy(desc(suggestHistory.checkedAt));

        // 前回のsentimentマップ作成
        const prevSentimentMap = new Map<string, string>();
        for (const prev of prevData) {
          if (!prevSentimentMap.has(prev.suggestText)) {
            prevSentimentMap.set(prev.suggestText, prev.sentiment);
          }
        }

        // DB保存
        const now = new Date();
        const insertData = suggestions.map((s) => ({
          keywordId: kw.id,
          suggestText: s.text,
          position: s.position,
          sentiment: (prevSentimentMap.get(s.text) || "unclassified") as "negative" | "neutral" | "positive" | "unclassified",
          checkedAt: now,
        }));

        if (insertData.length > 0) {
          await db.insert(suggestHistory).values(insertData);
        }

        results.push({ keyword: kw.keyword, count: suggestions.length, cached: false });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ keyword: kw.keyword, count: 0, cached: false, error: errorMsg });
      }
    }

    const cachedCount = results.filter((r) => r.cached).length;

    return NextResponse.json({
      message: cachedCount > 0
        ? `サジェスト取得完了（${cachedCount}件はキャッシュ利用）`
        : "サジェスト取得が完了しました",
      results,
    });
  } catch (error) {
    console.error("サジェスト取得エラー:", error);
    return NextResponse.json(
      { error: "サジェストの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// PUT: sentiment分類の更新
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
        { error: "sentimentはnegative/neutral/positive/unclassifiedのいずれかです" },
        { status: 400 }
      );
    }

    const updated = await db
      .update(suggestHistory)
      .set({ sentiment })
      .where(eq(suggestHistory.id, id))
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

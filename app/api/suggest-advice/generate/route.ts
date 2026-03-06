import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { keywords, suggestHistory, suggestAdvice } from "@/lib/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import { generateSuggestAdvice } from "@/lib/gemini-advice";

// 本日の0時（JST）を取得
function getTodayStartJST(): Date {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const jstToday = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());
  return new Date(jstToday.getTime() - jstOffset);
}

// POST: AIによる対策アドバイス生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywordId } = body;

    if (!keywordId) {
      return NextResponse.json(
        { error: "keywordIdは必須です" },
        { status: 400 }
      );
    }

    // キーワード取得
    const kw = await db.query.keywords.findFirst({
      where: eq(keywords.id, keywordId),
    });

    if (!kw) {
      return NextResponse.json(
        { error: "キーワードが見つかりません" },
        { status: 404 }
      );
    }

    // 当日のサジェストデータを取得
    const todayStart = getTodayStartJST();
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    let suggests = await db
      .select()
      .from(suggestHistory)
      .where(
        and(
          eq(suggestHistory.keywordId, keywordId),
          gte(suggestHistory.checkedAt, todayStart),
          lt(suggestHistory.checkedAt, todayEnd)
        )
      )
      .orderBy(suggestHistory.position);

    // 当日データがなければ直近のデータを取得
    if (suggests.length === 0) {
      suggests = await db
        .select()
        .from(suggestHistory)
        .where(eq(suggestHistory.keywordId, keywordId))
        .orderBy(suggestHistory.position)
        .limit(20);
    }

    if (suggests.length === 0) {
      return NextResponse.json(
        { error: "サジェストデータがありません。先にサジェスト取得を実行してください。" },
        { status: 400 }
      );
    }

    // Gemini AIでアドバイス生成
    const suggestItems = suggests.map((s) => ({
      text: s.suggestText,
      sentiment: s.sentiment,
    }));

    const generatedAdvice = await generateSuggestAdvice(kw.keyword, suggestItems);

    // DBに保存
    const now = new Date();
    const insertedAdvice = [];

    for (const adv of generatedAdvice) {
      const inserted = await db
        .insert(suggestAdvice)
        .values({
          keywordId,
          suggestText: adv.suggestText,
          advice: adv.advice,
          status: "todo",
          priority: adv.priority,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      insertedAdvice.push(inserted[0]);
    }

    return NextResponse.json({
      message: `${insertedAdvice.length}件の対策アドバイスを生成しました`,
      advice: insertedAdvice,
    });
  } catch (error) {
    console.error("AI対策アドバイス生成エラー:", error);
    const errorMsg = error instanceof Error ? error.message : "AI対策アドバイスの生成に失敗しました";
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

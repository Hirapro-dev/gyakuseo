import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { keywords, trackedUrls, rankingHistory } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSearchRankings } from "@/lib/google-search";

// Vercel Cron用エンドポイント（毎日AM9時 JST）
export async function GET(request: NextRequest) {
  try {
    // CRON_SECRETによる認証チェック
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error("Cron認証エラー: 不正なトークンです");
      return NextResponse.json(
        { error: "認証に失敗しました" },
        { status: 401 }
      );
    }

    // アクティブなキーワードを全て取得
    const activeKeywords = await db.query.keywords.findMany({
      where: eq(keywords.isActive, true),
    });

    if (activeKeywords.length === 0) {
      console.log("Cron実行: アクティブなキーワードがありません");
      return NextResponse.json({
        message: "アクティブなキーワードがありません",
        processed: 0,
      });
    }

    console.log(
      `Cron実行開始: ${activeKeywords.length}件のキーワードを処理します`
    );

    let totalProcessed = 0;
    const errors: string[] = [];

    // 各キーワードについて順位を取得
    for (const kw of activeKeywords) {
      try {
        // キーワードに紐づくURLを取得
        const urls = await db.query.trackedUrls.findMany({
          where: eq(trackedUrls.keywordId, kw.id),
        });

        if (urls.length === 0) {
          console.log(`スキップ: "${kw.keyword}" - 登録URLなし`);
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
        console.log(
          `計測完了: "${kw.keyword}" - ${rankings.length}件のURL順位を保存`
        );
      } catch (error) {
        const errorMsg = `"${kw.keyword}" の計測に失敗: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    console.log(`Cron実行完了: ${totalProcessed}件の順位データを保存しました`);

    return NextResponse.json({
      message: "Cron実行が完了しました",
      processed: totalProcessed,
      keywordsChecked: activeKeywords.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Cron実行エラー:", error);
    return NextResponse.json(
      { error: "Cron実行に失敗しました" },
      { status: 500 }
    );
  }
}

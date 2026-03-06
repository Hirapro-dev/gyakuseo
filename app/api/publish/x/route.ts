import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rewrittenArticles, publishLogs } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { publishToX } from "@/lib/publishers/x";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId, manual } = body;

    // 手動投稿済みの記録
    if (manual) {
      await db.insert(publishLogs).values({
        articleId,
        platform: "x",
        status: "manual",
      });
      return NextResponse.json({ message: "手動投稿を記録しました" });
    }

    // X向けリライト記事を取得
    const rewritten = await db.query.rewrittenArticles.findFirst({
      where: and(
        eq(rewrittenArticles.articleId, articleId),
        eq(rewrittenArticles.platform, "x")
      ),
    });

    if (!rewritten) {
      return NextResponse.json(
        { error: "X向けのリライト記事がありません。先にAIリライトを実行してください。" },
        { status: 400 }
      );
    }

    // ハッシュタグ付きテキストを生成
    let text = rewritten.rewrittenBody;
    if (rewritten.hashtags) {
      text += "\n" + rewritten.hashtags;
    }

    const result = await publishToX(text);

    // 投稿ログ記録
    await db.insert(publishLogs).values({
      articleId,
      platform: "x",
      status: "success",
      publishedUrl: result.url,
    });

    console.log(`X投稿成功: ${result.url}`);
    return NextResponse.json({ message: "X投稿成功", url: result.url });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("X投稿エラー:", errorMessage);

    try {
      const body = await request.clone().json();
      await db.insert(publishLogs).values({
        articleId: body.articleId,
        platform: "x",
        status: "failed",
        errorMessage,
      });
    } catch { /* ログ記録失敗は無視 */ }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

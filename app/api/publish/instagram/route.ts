import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rewrittenArticles, publishLogs } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { publishToInstagram } from "@/lib/publishers/instagram";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId, manual, imageUrl } = body;

    // 手動投稿済みの記録
    if (manual) {
      await db.insert(publishLogs).values({
        articleId,
        platform: "instagram",
        status: "manual",
      });
      return NextResponse.json({ message: "手動投稿を記録しました" });
    }

    // Instagram向けリライト記事を取得
    const rewritten = await db.query.rewrittenArticles.findFirst({
      where: and(
        eq(rewrittenArticles.articleId, articleId),
        eq(rewrittenArticles.platform, "instagram")
      ),
    });

    if (!rewritten) {
      return NextResponse.json(
        { error: "Instagram向けのリライト記事がありません。先にAIリライトを実行してください。" },
        { status: 400 }
      );
    }

    // キャプション生成
    let caption = rewritten.rewrittenBody;
    if (rewritten.hashtags) {
      caption += "\n\n" + rewritten.hashtags;
    }

    const result = await publishToInstagram(caption, imageUrl);

    // 投稿ログ記録
    await db.insert(publishLogs).values({
      articleId,
      platform: "instagram",
      status: "success",
      publishedUrl: result.url,
    });

    console.log(`Instagram投稿成功: ${result.url}`);
    return NextResponse.json({ message: "Instagram投稿成功", url: result.url });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Instagram投稿エラー:", errorMessage);

    try {
      const body = await request.clone().json();
      await db.insert(publishLogs).values({
        articleId: body.articleId,
        platform: "instagram",
        status: "failed",
        errorMessage,
      });
    } catch { /* ログ記録失敗は無視 */ }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

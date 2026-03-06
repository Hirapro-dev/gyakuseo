import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { articles, rewrittenArticles, publishLogs } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { publishToWordPress } from "@/lib/publishers/wordpress";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId } = body;

    // リライト済み記事からWordPress用を探す（なければ元記事を使用）
    const article = await db.query.articles.findFirst({
      where: eq(articles.id, articleId),
    });

    if (!article) {
      return NextResponse.json({ error: "記事が見つかりません" }, { status: 404 });
    }

    // noteプラットフォームのリライトを使用（WordPress用がないため）
    // 実際にはWordPress向けのリライトを別途追加することも可能
    let title = article.title;
    let postBody = article.body;

    const rewritten = await db.query.rewrittenArticles.findFirst({
      where: and(
        eq(rewrittenArticles.articleId, articleId),
        eq(rewrittenArticles.platform, "note")
      ),
    });

    if (rewritten) {
      title = rewritten.rewrittenTitle;
      postBody = rewritten.rewrittenBody;
    }

    const result = await publishToWordPress(title, postBody);

    // 投稿ログ記録
    await db.insert(publishLogs).values({
      articleId,
      platform: "wordpress",
      status: "success",
      publishedUrl: result.url,
    });

    console.log(`WordPress投稿成功: ${result.url}`);
    return NextResponse.json({ message: "WordPress投稿成功", url: result.url });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("WordPress投稿エラー:", errorMessage);

    // エラーログ記録
    try {
      const body = await request.clone().json();
      await db.insert(publishLogs).values({
        articleId: body.articleId,
        platform: "wordpress",
        status: "failed",
        errorMessage,
      });
    } catch { /* ログ記録失敗は無視 */ }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

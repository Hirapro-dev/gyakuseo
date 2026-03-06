import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { articles, rewrittenArticles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { rewriteAllPlatforms } from "@/lib/claude-rewrite";

// AIリライト実行
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const articleId = parseInt(params.id);

    // 記事を取得
    const article = await db.query.articles.findFirst({
      where: eq(articles.id, articleId),
    });

    if (!article) {
      return NextResponse.json(
        { error: "記事が見つかりません" },
        { status: 404 }
      );
    }

    console.log(`AIリライト開始: "${article.title}" (ID: ${articleId})`);

    // 全プラットフォーム分リライト実行
    const results = await rewriteAllPlatforms(article.title, article.body);

    if (results.length === 0) {
      return NextResponse.json(
        { error: "リライトに失敗しました。ANTHROPIC_API_KEYを確認してください。" },
        { status: 500 }
      );
    }

    // 既存のリライト結果を削除（再生成時）
    await db
      .delete(rewrittenArticles)
      .where(eq(rewrittenArticles.articleId, articleId));

    // 新しいリライト結果を保存
    const saved = await db
      .insert(rewrittenArticles)
      .values(
        results.map((r) => ({
          articleId,
          platform: r.platform,
          rewrittenTitle: r.title,
          rewrittenBody: r.body,
          hashtags: r.hashtags,
        }))
      )
      .returning();

    console.log(
      `AIリライト完了: ${saved.length}プラットフォーム分生成しました`
    );

    return NextResponse.json({
      message: `${saved.length}プラットフォーム分のリライトが完了しました`,
      results: saved,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("AIリライトエラー:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { articles } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

// 記事一覧取得
export async function GET() {
  try {
    const allArticles = await db.query.articles.findMany({
      orderBy: [desc(articles.createdAt)],
      with: {
        keyword: true,
        rewrittenArticles: true,
        publishLogs: true,
      },
    });

    return NextResponse.json(allArticles);
  } catch (error) {
    console.error("記事一覧取得エラー:", error);
    return NextResponse.json(
      { error: "記事一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// 記事作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, body: articleBody, keywordId, status } = body;

    if (!title || !articleBody) {
      return NextResponse.json(
        { error: "タイトルと本文は必須です" },
        { status: 400 }
      );
    }

    const now = new Date();
    const newArticle = await db
      .insert(articles)
      .values({
        title,
        body: articleBody,
        keywordId: keywordId || null,
        status: status || "draft",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    console.log(`記事作成完了: "${title}"`);
    return NextResponse.json(newArticle[0], { status: 201 });
  } catch (error) {
    console.error("記事作成エラー:", error);
    return NextResponse.json(
      { error: "記事の作成に失敗しました" },
      { status: 500 }
    );
  }
}

// 記事更新
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, body: articleBody, keywordId, status } = body;

    if (!id) {
      return NextResponse.json(
        { error: "記事IDは必須です" },
        { status: 400 }
      );
    }

    const updated = await db
      .update(articles)
      .set({
        ...(title !== undefined && { title }),
        ...(articleBody !== undefined && { body: articleBody }),
        ...(keywordId !== undefined && { keywordId: keywordId || null }),
        ...(status !== undefined && { status }),
        updatedAt: new Date(),
      })
      .where(eq(articles.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "記事が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("記事更新エラー:", error);
    return NextResponse.json(
      { error: "記事の更新に失敗しました" },
      { status: 500 }
    );
  }
}

// 記事削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "記事IDは必須です" },
        { status: 400 }
      );
    }

    await db.delete(articles).where(eq(articles.id, parseInt(id)));
    return NextResponse.json({ message: "記事を削除しました" });
  } catch (error) {
    console.error("記事削除エラー:", error);
    return NextResponse.json(
      { error: "記事の削除に失敗しました" },
      { status: 500 }
    );
  }
}

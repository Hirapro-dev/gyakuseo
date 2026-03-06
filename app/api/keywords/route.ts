import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { keywords } from "@/lib/schema";
import { eq } from "drizzle-orm";

// キーワード一覧取得
export async function GET() {
  try {
    const allKeywords = await db.query.keywords.findMany({
      orderBy: (keywords, { desc }) => [desc(keywords.createdAt)],
      with: {
        trackedUrls: true,
      },
    });
    return NextResponse.json(allKeywords);
  } catch (error) {
    console.error("キーワード取得エラー:", error);
    return NextResponse.json(
      { error: "キーワードの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// キーワード新規作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyword, memo, isActive } = body;

    if (!keyword || keyword.trim() === "") {
      return NextResponse.json(
        { error: "キーワードは必須です" },
        { status: 400 }
      );
    }

    const newKeyword = await db
      .insert(keywords)
      .values({
        keyword: keyword.trim(),
        memo: memo || null,
        isActive: isActive ?? true,
      })
      .returning();

    return NextResponse.json(newKeyword[0], { status: 201 });
  } catch (error) {
    console.error("キーワード作成エラー:", error);
    return NextResponse.json(
      { error: "キーワードの作成に失敗しました" },
      { status: 500 }
    );
  }
}

// キーワード更新
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, keyword, memo, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: "IDは必須です" },
        { status: 400 }
      );
    }

    const updated = await db
      .update(keywords)
      .set({
        ...(keyword !== undefined && { keyword: keyword.trim() }),
        ...(memo !== undefined && { memo }),
        ...(isActive !== undefined && { isActive }),
      })
      .where(eq(keywords.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "キーワードが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("キーワード更新エラー:", error);
    return NextResponse.json(
      { error: "キーワードの更新に失敗しました" },
      { status: 500 }
    );
  }
}

// キーワード削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "IDは必須です" },
        { status: 400 }
      );
    }

    const deleted = await db
      .delete(keywords)
      .where(eq(keywords.id, parseInt(id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "キーワードが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "キーワードを削除しました" });
  } catch (error) {
    console.error("キーワード削除エラー:", error);
    return NextResponse.json(
      { error: "キーワードの削除に失敗しました" },
      { status: 500 }
    );
  }
}

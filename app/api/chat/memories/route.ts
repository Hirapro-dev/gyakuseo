import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatMemories } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

// GET: メモリ一覧取得
export async function GET() {
  try {
    const memories = await db.query.chatMemories.findMany({
      orderBy: [desc(chatMemories.createdAt)],
    });
    return NextResponse.json(memories);
  } catch (error) {
    console.error("メモリ取得エラー:", error);
    return NextResponse.json(
      { error: "メモリの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: メモリ個別削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "idは必須です" },
        { status: 400 }
      );
    }

    const deleted = await db
      .delete(chatMemories)
      .where(eq(chatMemories.id, parseInt(id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "メモリが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "メモリを削除しました",
    });
  } catch (error) {
    console.error("メモリ削除エラー:", error);
    return NextResponse.json(
      { error: "メモリの削除に失敗しました" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { suggestAdvice } from "@/lib/schema";
import { eq } from "drizzle-orm";

// GET: 対策アドバイス一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get("keywordId");

    if (!keywordId) {
      return NextResponse.json(
        { error: "keywordIdは必須です" },
        { status: 400 }
      );
    }

    const adviceList = await db
      .select()
      .from(suggestAdvice)
      .where(eq(suggestAdvice.keywordId, parseInt(keywordId)))
      .orderBy(suggestAdvice.createdAt);

    return NextResponse.json(adviceList);
  } catch (error) {
    console.error("対策アドバイス取得エラー:", error);
    return NextResponse.json(
      { error: "対策アドバイスの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: 対策アドバイス追加
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywordId, suggestText, advice, priority } = body;

    if (!keywordId || !advice) {
      return NextResponse.json(
        { error: "keywordIdとadviceは必須です" },
        { status: 400 }
      );
    }

    const inserted = await db
      .insert(suggestAdvice)
      .values({
        keywordId,
        suggestText: suggestText || null,
        advice,
        status: "todo",
        priority: priority || "medium",
      })
      .returning();

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (error) {
    console.error("対策アドバイス追加エラー:", error);
    return NextResponse.json(
      { error: "対策アドバイスの追加に失敗しました" },
      { status: 500 }
    );
  }
}

// PUT: 対策アドバイス更新（ステータス・内容・優先度）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, advice, status, priority } = body;

    if (!id) {
      return NextResponse.json(
        { error: "idは必須です" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (advice !== undefined) updateData.advice = advice;
    if (status !== undefined) {
      const validStatuses = ["todo", "in_progress", "done"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: "statusはtodo/in_progress/doneのいずれかです" },
          { status: 400 }
        );
      }
      updateData.status = status;
    }
    if (priority !== undefined) {
      const validPriorities = ["high", "medium", "low"];
      if (!validPriorities.includes(priority)) {
        return NextResponse.json(
          { error: "priorityはhigh/medium/lowのいずれかです" },
          { status: 400 }
        );
      }
      updateData.priority = priority;
    }

    const updated = await db
      .update(suggestAdvice)
      .set(updateData)
      .where(eq(suggestAdvice.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "レコードが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("対策アドバイス更新エラー:", error);
    return NextResponse.json(
      { error: "対策アドバイスの更新に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: 対策アドバイス削除
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
      .delete(suggestAdvice)
      .where(eq(suggestAdvice.id, parseInt(id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "レコードが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "削除しました" });
  } catch (error) {
    console.error("対策アドバイス削除エラー:", error);
    return NextResponse.json(
      { error: "対策アドバイスの削除に失敗しました" },
      { status: 500 }
    );
  }
}

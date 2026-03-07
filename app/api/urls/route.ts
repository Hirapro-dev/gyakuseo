import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackedUrls } from "@/lib/schema";
import { eq } from "drizzle-orm";

// URL一覧取得（キーワードIDでフィルタ可能）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get("keywordId");

    let urls;
    if (keywordId) {
      urls = await db.query.trackedUrls.findMany({
        where: eq(trackedUrls.keywordId, parseInt(keywordId)),
        orderBy: (trackedUrls, { asc }) => [asc(trackedUrls.type)],
      });
    } else {
      urls = await db.query.trackedUrls.findMany({
        orderBy: (trackedUrls, { desc }) => [desc(trackedUrls.createdAt)],
        with: {
          keyword: true,
        },
      });
    }

    return NextResponse.json(urls);
  } catch (error) {
    console.error("URL取得エラー:", error);
    return NextResponse.json(
      { error: "URLの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// URL新規作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywordId, url, type, label } = body;

    if (!keywordId || !url || !type) {
      return NextResponse.json(
        { error: "keywordId, url, type は必須です" },
        { status: 400 }
      );
    }

    if (type !== "negative" && type !== "positive" && type !== "neutral") {
      return NextResponse.json(
        { error: "type は 'negative', 'positive', 'neutral' のいずれかである必要があります" },
        { status: 400 }
      );
    }

    const newUrl = await db
      .insert(trackedUrls)
      .values({
        keywordId,
        url: url.trim(),
        type,
        label: label || null,
      })
      .returning();

    return NextResponse.json(newUrl[0], { status: 201 });
  } catch (error) {
    console.error("URL作成エラー:", error);
    return NextResponse.json(
      { error: "URLの作成に失敗しました" },
      { status: 500 }
    );
  }
}

// URL更新
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, url, type, label } = body;

    if (!id) {
      return NextResponse.json(
        { error: "IDは必須です" },
        { status: 400 }
      );
    }

    const updated = await db
      .update(trackedUrls)
      .set({
        ...(url !== undefined && { url: url.trim() }),
        ...(type !== undefined && { type }),
        ...(label !== undefined && { label }),
      })
      .where(eq(trackedUrls.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "URLが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("URL更新エラー:", error);
    return NextResponse.json(
      { error: "URLの更新に失敗しました" },
      { status: 500 }
    );
  }
}

// URL削除
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
      .delete(trackedUrls)
      .where(eq(trackedUrls.id, parseInt(id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "URLが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "URLを削除しました" });
  } catch (error) {
    console.error("URL削除エラー:", error);
    return NextResponse.json(
      { error: "URLの削除に失敗しました" },
      { status: 500 }
    );
  }
}

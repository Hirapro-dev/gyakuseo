import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatMessages } from "@/lib/schema";
import { eq } from "drizzle-orm";

// GET: 特定セッションのメッセージ一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionIdは必須です" },
        { status: 400 }
      );
    }

    const messages = await db.query.chatMessages.findMany({
      where: eq(chatMessages.sessionId, parseInt(sessionId)),
      orderBy: [chatMessages.createdAt],
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("メッセージ取得エラー:", error);
    return NextResponse.json(
      { error: "メッセージの取得に失敗しました" },
      { status: 500 }
    );
  }
}

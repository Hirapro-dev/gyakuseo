import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatSessions, chatMessages, chatMemories } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { generateChatResponse } from "@/lib/gemini-chat";

// GET: セッション一覧取得
export async function GET() {
  try {
    const sessions = await db.query.chatSessions.findMany({
      orderBy: [desc(chatSessions.updatedAt)],
    });
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("セッション一覧取得エラー:", error);
    return NextResponse.json(
      { error: "セッション一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: メッセージ送信 → AI応答生成 → DB保存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, message } = body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return NextResponse.json(
        { error: "メッセージは必須です" },
        { status: 400 }
      );
    }

    let currentSessionId = sessionId;

    // セッションが指定されていなければ新規作成
    if (!currentSessionId) {
      // セッションタイトル: メッセージの先頭30文字
      const title = message.trim().slice(0, 30) + (message.length > 30 ? "..." : "");
      const [newSession] = await db
        .insert(chatSessions)
        .values({
          title,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      currentSessionId = newSession.id;
    }

    // ユーザーメッセージをDB保存
    await db.insert(chatMessages).values({
      sessionId: currentSessionId,
      role: "user",
      content: message.trim(),
      createdAt: new Date(),
    });

    // 既存の会話履歴を取得
    const history = await db.query.chatMessages.findMany({
      where: eq(chatMessages.sessionId, currentSessionId),
      orderBy: [chatMessages.createdAt],
    });

    // Gemini AIで応答生成
    const chatHistory = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const aiResponse = await generateChatResponse(chatHistory, message.trim());

    // AI応答をDB保存
    const [savedMessage] = await db
      .insert(chatMessages)
      .values({
        sessionId: currentSessionId,
        role: "assistant",
        content: aiResponse.reply,
        createdAt: new Date(),
      })
      .returning();

    // セッションのupdatedAtを更新
    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, currentSessionId));

    // メモリがあれば保存
    if (aiResponse.memory) {
      await db.insert(chatMemories).values({
        content: aiResponse.memory,
        source: `セッション#${currentSessionId}`,
        createdAt: new Date(),
      });
    }

    return NextResponse.json({
      sessionId: currentSessionId,
      reply: aiResponse.reply,
      messageId: savedMessage.id,
      memorySaved: !!aiResponse.memory,
    });
  } catch (error) {
    console.error("チャットエラー:", error);
    const errorMsg = error instanceof Error ? error.message : "チャットの処理に失敗しました";
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

// DELETE: セッション削除（カスケードでメッセージも削除）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionIdは必須です" },
        { status: 400 }
      );
    }

    const id = parseInt(sessionId);

    // カスケード削除（スキーマで onDelete: "cascade" 設定済み）
    const deleted = await db
      .delete(chatSessions)
      .where(eq(chatSessions.id, id))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "セッションが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "セッションを削除しました",
    });
  } catch (error) {
    console.error("セッション削除エラー:", error);
    return NextResponse.json(
      { error: "セッションの削除に失敗しました" },
      { status: 500 }
    );
  }
}

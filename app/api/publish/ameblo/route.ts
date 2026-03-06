import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publishLogs } from "@/lib/schema";

// アメブロ - 手動投稿記録用API（コピペ補助）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId } = body;

    await db.insert(publishLogs).values({
      articleId,
      platform: "ameblo",
      status: "manual",
    });

    return NextResponse.json({ message: "アメブロ手動投稿を記録しました" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("アメブロ投稿記録エラー:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

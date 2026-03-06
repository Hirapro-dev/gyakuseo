import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publishLogs } from "@/lib/schema";
import { desc } from "drizzle-orm";

// 投稿ログ一覧取得（直近のものから）
export async function GET() {
  try {
    const logs = await db.query.publishLogs.findMany({
      orderBy: [desc(publishLogs.publishedAt)],
      limit: 20,
      with: {
        article: true,
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("投稿ログ取得エラー:", error);
    return NextResponse.json(
      { error: "投稿ログの取得に失敗しました" },
      { status: 500 }
    );
  }
}

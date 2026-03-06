import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ownedSites, ownedSiteKeywords } from "@/lib/schema";
import { eq } from "drizzle-orm";

// 自社サイト一覧取得（中間テーブル経由でキーワード・trackedUrlも取得）
export async function GET() {
  try {
    const sites = await db.query.ownedSites.findMany({
      orderBy: (ownedSites, { desc }) => [desc(ownedSites.createdAt)],
      with: {
        ownedSiteKeywords: {
          with: {
            keyword: true,
            trackedUrl: true,
          },
        },
      },
    });

    return NextResponse.json(sites);
  } catch (error) {
    console.error("自社サイト取得エラー:", error);
    return NextResponse.json(
      { error: "自社サイトの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// 自社サイト新規作成
// keywordLinks: [{ keywordId, trackedUrlId? }]
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serviceName, pageUrl, loginUrl, loginId, loginPassword, memo, keywordLinks } = body;

    if (!serviceName || !pageUrl) {
      return NextResponse.json(
        { error: "サービス名と表示ページURLは必須です" },
        { status: 400 }
      );
    }

    // サイト本体を作成
    const newSite = await db
      .insert(ownedSites)
      .values({
        serviceName: serviceName.trim(),
        pageUrl: pageUrl.trim(),
        loginUrl: loginUrl?.trim() || null,
        loginId: loginId?.trim() || null,
        loginPassword: loginPassword?.trim() || null,
        memo: memo?.trim() || null,
      })
      .returning();

    const siteId = newSite[0].id;

    // キーワードリンクを作成
    if (keywordLinks && keywordLinks.length > 0) {
      const linkValues = keywordLinks.map((link: { keywordId: number; trackedUrlId?: number | null }) => ({
        ownedSiteId: siteId,
        keywordId: link.keywordId,
        trackedUrlId: link.trackedUrlId || null,
      }));
      await db.insert(ownedSiteKeywords).values(linkValues);
    }

    return NextResponse.json(newSite[0], { status: 201 });
  } catch (error) {
    console.error("自社サイト作成エラー:", error);
    return NextResponse.json(
      { error: "自社サイトの作成に失敗しました" },
      { status: 500 }
    );
  }
}

// 自社サイト更新
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, serviceName, pageUrl, loginUrl, loginId, loginPassword, memo, keywordLinks } = body;

    if (!id) {
      return NextResponse.json(
        { error: "IDは必須です" },
        { status: 400 }
      );
    }

    const updated = await db
      .update(ownedSites)
      .set({
        ...(serviceName !== undefined && { serviceName: serviceName.trim() }),
        ...(pageUrl !== undefined && { pageUrl: pageUrl.trim() }),
        ...(loginUrl !== undefined && { loginUrl: loginUrl?.trim() || null }),
        ...(loginId !== undefined && { loginId: loginId?.trim() || null }),
        ...(loginPassword !== undefined && { loginPassword: loginPassword?.trim() || null }),
        ...(memo !== undefined && { memo: memo?.trim() || null }),
        updatedAt: new Date(),
      })
      .where(eq(ownedSites.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "サイトが見つかりません" },
        { status: 404 }
      );
    }

    // キーワードリンクを再作成（全削除→再挿入）
    if (keywordLinks !== undefined) {
      await db.delete(ownedSiteKeywords).where(eq(ownedSiteKeywords.ownedSiteId, id));

      if (keywordLinks.length > 0) {
        const linkValues = keywordLinks.map((link: { keywordId: number; trackedUrlId?: number | null }) => ({
          ownedSiteId: id,
          keywordId: link.keywordId,
          trackedUrlId: link.trackedUrlId || null,
        }));
        await db.insert(ownedSiteKeywords).values(linkValues);
      }
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("自社サイト更新エラー:", error);
    return NextResponse.json(
      { error: "自社サイトの更新に失敗しました" },
      { status: 500 }
    );
  }
}

// 自社サイト削除
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
      .delete(ownedSites)
      .where(eq(ownedSites.id, parseInt(id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "サイトが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "サイトを削除しました" });
  } catch (error) {
    console.error("自社サイト削除エラー:", error);
    return NextResponse.json(
      { error: "サイトの削除に失敗しました" },
      { status: 500 }
    );
  }
}

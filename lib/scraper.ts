import * as cheerio from "cheerio";

// スクレイピング結果の型
export interface ScrapedPageContent {
  title: string; // ページタイトル
  description: string; // meta description
  bodyText: string; // メインコンテンツのテキスト（最大2000文字）
  headings: string[]; // h1-h3の見出し一覧
  url: string; // 元URL
}

/**
 * 指定URLのページ内容をスクレイピングしてテキスト抽出する
 * エラー時はnullを返す（呼び出し側でスキップ可能）
 */
export async function scrapePageContent(
  url: string
): Promise<ScrapedPageContent | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RankGuard/1.0; +https://rankguard.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000), // 10秒タイムアウト
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // 不要な要素を除去
    $(
      "script, style, nav, header, footer, aside, iframe, noscript, svg"
    ).remove();

    // タイトル取得
    const title =
      $("title").text().trim() || $("h1").first().text().trim() || "";

    // meta description取得
    const description =
      $('meta[name="description"]').attr("content")?.trim() || "";

    // 見出しを抽出（h1-h3）
    const headings: string[] = [];
    $("h1, h2, h3").each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length < 200) headings.push(text);
    });

    // メインコンテンツのテキストを抽出
    // article, main, .content などの主要要素を優先
    let mainContent = $(
      "article, main, [role='main'], .content, .post, .entry, .article-body"
    ).text();
    if (!mainContent || mainContent.trim().length < 100) {
      mainContent = $("body").text();
    }

    // 空白を正規化し、最大2000文字にトランケート
    const bodyText = mainContent
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);

    return { title, description, bodyText, headings: headings.slice(0, 20), url };
  } catch (error) {
    console.error(`スクレイピングエラー (${url}):`, error);
    return null;
  }
}

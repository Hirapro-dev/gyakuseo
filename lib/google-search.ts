// SerpAPI レスポンスの型定義
interface SerpApiOrganicResult {
  position: number;
  title: string;
  link: string;
  snippet?: string;
}

interface SerpApiResponse {
  organic_results?: SerpApiOrganicResult[];
  search_information?: {
    total_results?: number;
  };
  error?: string;
}

// 検索結果の型
export interface SearchResult {
  url: string;
  rank: number; // 1〜10: 検索順位、101: 圏外
}

/**
 * SerpAPIでGoogle検索結果を取得し、
 * 対象URLの順位を返す
 */
export async function getSearchRankings(
  keyword: string,
  targetUrls: string[]
): Promise<SearchResult[]> {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    throw new Error("環境変数 SERPAPI_KEY が設定されていません");
  }

  // SerpAPI リクエスト（Google検索、日本語、上位100件）
  const params = new URLSearchParams({
    api_key: apiKey,
    engine: "google",
    q: keyword,
    gl: "jp",        // 日本のGoogle検索
    hl: "ja",        // 日本語
    num: "100",       // 上位100件取得（より正確な順位判定）
  });

  const response = await fetch(
    `https://serpapi.com/search.json?${params.toString()}`
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`SerpAPIエラー: ${response.status} - ${errorBody}`);
    throw new Error(`SerpAPIエラー: ${response.status} - ${errorBody}`);
  }

  const data: SerpApiResponse = await response.json();

  if (data.error) {
    console.error(`SerpAPIエラー: ${data.error}`);
    throw new Error(`SerpAPIエラー: ${data.error}`);
  }

  const organicResults = data.organic_results || [];

  // 各対象URLの順位を判定
  const results: SearchResult[] = targetUrls.map((targetUrl) => {
    // URLの部分一致で検索（ドメイン+パスの一部で判定）
    const found = organicResults.find((result) => {
      return (
        result.link.includes(targetUrl) ||
        targetUrl.includes(result.link) ||
        // ドメインとパスの先頭部分で比較
        normalizeUrl(result.link) === normalizeUrl(targetUrl)
      );
    });

    return {
      url: targetUrl,
      rank: found ? found.position : 101, // 圏外は101
    };
  });

  console.log(
    `検索完了: "${keyword}" - ${results.length}件のURL順位を取得しました`
  );

  return results;
}

/**
 * URLを正規化して比較しやすくする
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // www. を除去し、末尾のスラッシュを除去
    return (parsed.hostname.replace(/^www\./, "") + parsed.pathname).replace(
      /\/$/,
      ""
    );
  } catch {
    return url;
  }
}

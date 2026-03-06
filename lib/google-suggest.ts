// SerpAPI Autocomplete レスポンスの型定義
interface SerpApiSuggestion {
  value: string;
  relevance?: number;
}

interface SerpApiAutocompleteResponse {
  suggestions?: SerpApiSuggestion[];
  error?: string;
}

// サジェスト結果の型
export interface SuggestResult {
  text: string;
  position: number;
}

/**
 * SerpAPIでGoogleオートコンプリート（サジェスト）を取得する
 */
export async function getGoogleSuggestions(
  keyword: string
): Promise<SuggestResult[]> {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    throw new Error("環境変数 SERPAPI_KEY が設定されていません");
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    engine: "google_autocomplete",
    q: keyword,
    gl: "jp",
    hl: "ja",
  });

  const response = await fetch(
    `https://serpapi.com/search.json?${params.toString()}`
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`SerpAPI Autocompleteエラー: ${response.status} - ${errorBody}`);
    throw new Error(`SerpAPI Autocompleteエラー: ${response.status} - ${errorBody}`);
  }

  const data: SerpApiAutocompleteResponse = await response.json();

  if (data.error) {
    console.error(`SerpAPI Autocompleteエラー: ${data.error}`);
    throw new Error(`SerpAPI Autocompleteエラー: ${data.error}`);
  }

  const suggestions = data.suggestions || [];

  const results: SuggestResult[] = suggestions.map((s, index) => ({
    text: s.value,
    position: index,
  }));

  console.log(
    `サジェスト取得完了: "${keyword}" - ${results.length}件のサジェストを取得しました`
  );

  return results;
}

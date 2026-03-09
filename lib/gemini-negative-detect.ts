import { GoogleGenerativeAI } from "@google/generative-ai";

// 検索結果の入力型
interface SearchResultInput {
  position: number;
  title: string;
  url: string;
  snippet: string;
}

// AI判定結果の型
export interface NegativeDetectResult {
  position: number;
  title: string;
  url: string;
  snippet: string;
  sentiment: "negative" | "neutral" | "positive";
  reason: string;
}

/**
 * Gemini APIで検索結果のネガティブ記事判定を行う
 */
export async function detectNegativeArticles(
  keyword: string,
  results: SearchResultInput[]
): Promise<NegativeDetectResult[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("環境変数 GEMINI_API_KEY が設定されていません");
  }

  if (results.length === 0) {
    return [];
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // 検索結果をテキスト化
  const resultsList = results
    .map(
      (r) =>
        `[${r.position}位] タイトル: 「${r.title}」\nURL: ${r.url}\nスニペット: ${r.snippet || "なし"}`
    )
    .join("\n\n");

  const prompt = `あなたはレピュテーション管理（評判管理）の専門家です。

以下はGoogleで「${keyword}」と検索した際に表示される検索結果（上位${results.length}件）です。

${resultsList}

上記の各検索結果について、「${keyword}」というブランド・企業・個人にとって**ネガティブな内容かどうか**を判定してください。

## 判定基準
- **negative（ネガティブ）**: 悪評、批判、苦情、トラブル報告、炎上、法的問題、詐欺疑惑、退職者の暴露、マイナスイメージに繋がる記事
- **neutral（ニュートラル）**: 事実の報道、一般的な情報、中立的な説明、公式サイト自体
- **positive（ポジティブ）**: 良い評判、推薦、成功事例、ポジティブなレビュー、公式の前向きな情報発信

## 出力形式
以下のJSON配列形式で、全件分の判定結果を返してください。
必ず有効なJSONのみを返してください。説明やマークダウンは不要です。

[
  {
    "position": 検索順位の数値,
    "sentiment": "negative" or "neutral" or "positive",
    "reason": "判定理由を簡潔に（50文字以内）"
  }
]

注意:
- タイトルとスニペットの内容から総合的に判定してください
- URL先の実際のコンテンツは見れないため、タイトル・スニペットから推測してください
- 判定に迷う場合は neutral としてください
- 口コミサイト（みん評、転職会議など）は内容次第でネガティブの可能性が高いです
- 比較サイトの「〇〇 vs △△」は基本 neutral です`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  // JSONパース（マークダウンのコードブロックを除去）
  const jsonStr = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    const parsed: { position: number; sentiment: string; reason: string }[] =
      JSON.parse(jsonStr);

    // 元の検索結果と結合
    return results.map((r) => {
      const aiResult = parsed.find((p) => p.position === r.position);
      const sentiment =
        aiResult && ["negative", "neutral", "positive"].includes(aiResult.sentiment)
          ? (aiResult.sentiment as "negative" | "neutral" | "positive")
          : "neutral";

      return {
        position: r.position,
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        sentiment,
        reason: aiResult?.reason || "判定なし",
      };
    });
  } catch (error) {
    console.error("Geminiレスポンスのパースエラー:", error);
    console.error("レスポンス:", text);
    throw new Error("AIの応答を解析できませんでした。もう一度お試しください。");
  }
}

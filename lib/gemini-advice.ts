import { GoogleGenerativeAI } from "@google/generative-ai";

// サジェスト情報の型
interface SuggestItem {
  text: string;
  sentiment: string;
}

// AI生成アドバイスの型
export interface GeneratedAdvice {
  suggestText: string | null; // 特定サジェスト向けならテキスト、全体向けならnull
  advice: string;
  priority: "high" | "medium" | "low";
}

/**
 * Gemini APIでサジェスト対策アドバイスを生成する
 */
export async function generateSuggestAdvice(
  keyword: string,
  suggests: SuggestItem[]
): Promise<GeneratedAdvice[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("環境変数 GEMINI_API_KEY が設定されていません");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  // サジェスト一覧をテキスト化
  const suggestList = suggests
    .map((s) => `- 「${s.text}」（分類: ${s.sentiment}）`)
    .join("\n");

  const prompt = `あなたは逆SEO・レピュテーション管理の専門家です。

以下はGoogleで「${keyword}」と入力した際に表示されるサジェスト（オートコンプリート）の一覧と、その分類です。

${suggestList}

上記を踏まえて、以下の観点から具体的な対策アドバイスを生成してください。

## 対策アドバイスの観点
1. **ネガティブなサジェストへの対処法** - 検索結果を押し下げる・ポジティブなコンテンツで上書きする方法
2. **ポジティブなサジェストを押し上げる施策** - 良いサジェストを維持・強化する方法
3. **新たに狙うべきポジティブサジェスト** - 現在ないがあると良いサジェストの提案
4. **全体的な方針** - ブランドイメージ改善の総合戦略

## 出力形式
以下のJSON配列形式で、5〜10件のアドバイスを返してください。
必ず有効なJSONのみを返してください。説明やマークダウンは不要です。

[
  {
    "suggestText": "対象のサジェストテキスト（全体向けならnull）",
    "advice": "具体的な対策内容（100〜200文字程度）",
    "priority": "high, medium, lowのいずれか"
  }
]

注意:
- ネガティブ分類のサジェストには優先度「high」を付けてください
- 具体的なアクション（何を・どこで・どうするか）を含めてください
- 日本語のインターネットマーケティングの知見に基づいてください`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  // JSONパース（マークダウンのコードブロックを除去）
  const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const parsed: GeneratedAdvice[] = JSON.parse(jsonStr);
    return parsed.map((item) => ({
      suggestText: item.suggestText || null,
      advice: item.advice,
      priority: ["high", "medium", "low"].includes(item.priority)
        ? item.priority
        : "medium",
    }));
  } catch (error) {
    console.error("Geminiレスポンスのパースエラー:", error);
    console.error("レスポンス:", text);
    throw new Error("AIの応答を解析できませんでした。もう一度お試しください。");
  }
}

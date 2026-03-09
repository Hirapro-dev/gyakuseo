import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ScrapedPageContent } from "./scraper";

// サジェスト情報の型
interface SuggestItem {
  text: string;
  sentiment: string;
}

// 自社サイト情報の型
export interface OwnedSiteInfo {
  serviceName: string;
  pageUrl: string;
  scrapedContent: ScrapedPageContent | null;
}

// AI生成アドバイスの型
export interface GeneratedAdvice {
  suggestText: string | null; // 特定サジェスト向けならテキスト、全体向けならnull
  advice: string;
  priority: "high" | "medium" | "low";
  targetSiteUrl: string | null; // 特定サイト向けならURL、全体向けならnull
}

/**
 * Gemini APIでサジェスト対策アドバイスを生成する
 * ownedSites が渡された場合、自社サイトの内容を踏まえたパーソナライズドアドバイスを生成
 */
export async function generateSuggestAdvice(
  keyword: string,
  suggests: SuggestItem[],
  ownedSites?: OwnedSiteInfo[]
): Promise<GeneratedAdvice[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("環境変数 GEMINI_API_KEY が設定されていません");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // サジェスト一覧をテキスト化
  const suggestList = suggests
    .map((s) => `- 「${s.text}」（分類: ${s.sentiment}）`)
    .join("\n");

  // 自社サイト情報セクション（パーソナライズ用）
  let ownedSitesSection = "";
  if (ownedSites && ownedSites.length > 0) {
    const siteDetails = ownedSites
      .map((site) => {
        let detail = `### ${site.serviceName}（${site.pageUrl}）`;
        if (site.scrapedContent) {
          const sc = site.scrapedContent;
          detail += `\n- タイトル: ${sc.title}`;
          if (sc.description) detail += `\n- 説明: ${sc.description}`;
          if (sc.headings.length > 0)
            detail += `\n- 見出し: ${sc.headings.slice(0, 10).join(" / ")}`;
          if (sc.bodyText)
            detail += `\n- 本文（抜粋）: ${sc.bodyText.slice(0, 500)}`;
        } else {
          detail += "\n- ※ページの内容を取得できませんでした";
        }
        return detail;
      })
      .join("\n\n");

    ownedSitesSection = `
## 自社サイトの現状
クライアントが逆SEO対策として運営しているサイト一覧と、その現在のコンテンツ内容です。
各サイトの内容を分析し、具体的な改善点を含むアドバイスを生成してください。

${siteDetails}
`;
  }

  // 既に使っている媒体名のリスト（重複提案を防ぐため）
  const existingSiteNames = ownedSites && ownedSites.length > 0
    ? ownedSites.map((s) => s.serviceName).join("、")
    : "";

  // パーソナライズの有無でプロンプトを分岐
  const personalizeInstruction = ownedSites && ownedSites.length > 0
    ? `
5. **各自社サイトへの具体的改善アドバイス** - サイトのコンテンツを分析し、以下を含めてください:
   - そのサイトで既にできていること（良い点）
   - そのサイトに足りないこと・改善すべき点
   - 具体的にどんなコンテンツを追加・修正すべきか
   - そのサイトがネガティブサジェスト対策にどう貢献できるか`
    : "";

  const newMediaInstruction = `
6. **新たに作るべき媒体・プラットフォームの提案** - 現在運営していない媒体の中で、逆SEO対策に効果的なものを提案してください:
   - **SNS**: X（旧Twitter）、Instagram、Facebook、YouTube、TikTok、LinkedIn、Threads など
   - **ブログ・情報サイト**: note、Ameblo、はてなブログ、WordPress、Medium、Qiita、Zenn など
   - **プロフィール・ビジネス系**: Googleビジネスプロフィール、Wantedly、Eight、PR TIMES など
   - **口コミ・レビュー系**: Googleマップ口コミ対策、食べログ、Retty、みん評 など
   - **ポートフォリオ・専門性アピール系**: 専門サイト、Wikipedia風ページ、業界メディア寄稿 など
   - 各媒体について「なぜその媒体が有効か」「どんなコンテンツを投稿すべきか」「期待される効果」を具体的に書いてください
   - ${existingSiteNames ? `※既に運営中の媒体: ${existingSiteNames} （これら以外を提案してください）` : "まだ媒体がないため、最優先で作るべきものから提案してください"}`;

  const targetSiteField = ownedSites && ownedSites.length > 0
    ? `    "targetSiteUrl": "対象サイトURLまたはnull（全体向け・新規媒体提案）",`
    : `    "targetSiteUrl": null,`;

  const prompt = `あなたは逆SEO・レピュテーション管理の日本市場トップクラスの専門家です。

以下はGoogleで「${keyword}」と入力した際に表示されるサジェスト（オートコンプリート）の一覧と、その分類です。

${suggestList}
${ownedSitesSection}
上記を踏まえて、以下の観点から具体的な対策アドバイスを生成してください。

## 対策アドバイスの観点
1. **ネガティブなサジェストへの対処法** - 検索結果を押し下げる・ポジティブなコンテンツで上書きする方法
2. **ポジティブなサジェストを押し上げる施策** - 良いサジェストを維持・強化する方法
3. **新たに狙うべきポジティブサジェスト** - 現在ないがあると良いサジェストの提案
4. **全体的な方針** - ブランドイメージ改善の総合戦略${personalizeInstruction}
${newMediaInstruction}

## 出力形式
以下のJSON配列形式で、8〜20件のアドバイスを返してください。
**必ず「新規媒体・プラットフォームの提案」を2〜5件含めてください。**
必ず有効なJSONのみを返してください。説明やマークダウンは不要です。

[
  {
    "suggestText": "対象のサジェストテキスト（全体向け・新規媒体提案ならnull）",
    "advice": "具体的な対策内容（100〜400文字程度。新規媒体提案の場合は【新規媒体提案】で始めて、媒体名・理由・投稿すべきコンテンツ・期待効果を含める）",
    "priority": "high, medium, lowのいずれか",
${targetSiteField}
  }
]

注意:
- ネガティブ分類のサジェストには優先度「high」を付けてください
- 具体的なアクション（何を・どこで・どうするか）を含めてください
- 日本語のインターネットマーケティング・逆SEOの最新の知見に基づいてください
- 自社サイト情報がある場合は、各サイトに対する具体的なアドバイスを優先してください
- 新規媒体提案では、その媒体がGoogle検索結果で上位表示されやすい理由や、サジェスト汚染対策としての効果を具体的に説明してください
- アドバイスの冒頭に【既存サイト改善】【新規媒体提案】【サジェスト対策】【全体戦略】などのタグを付けて分かりやすくしてください`;

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
      targetSiteUrl: item.targetSiteUrl || null,
    }));
  } catch (error) {
    console.error("Geminiレスポンスのパースエラー:", error);
    console.error("レスポンス:", text);
    throw new Error("AIの応答を解析できませんでした。もう一度お試しください。");
  }
}

import Anthropic from "@anthropic-ai/sdk";

// プラットフォーム種別
export type Platform =
  | "note"
  | "ameblo"
  | "linkedin"
  | "x"
  | "facebook"
  | "instagram";

// リライト結果の型
export interface RewriteResult {
  platform: Platform;
  title: string;
  body: string;
  hashtags: string;
}

// プラットフォーム別リライト設定
const PLATFORM_CONFIG: Record<
  Platform,
  { name: string; tone: string; length: string; hashtagCount: string }
> = {
  note: {
    name: "note",
    tone: "です・ます調、読みやすく",
    length: "800〜1500字",
    hashtagCount: "5個",
  },
  ameblo: {
    name: "アメブロ",
    tone: "親しみやすく柔らかい。絵文字を適度に使用",
    length: "600〜1200字",
    hashtagCount: "3個",
  },
  linkedin: {
    name: "LinkedIn",
    tone: "ビジネス文体、専門的",
    length: "500〜800字",
    hashtagCount: "3個",
  },
  x: {
    name: "X（Twitter）",
    tone: "端的に要約",
    length: "140字以内",
    hashtagCount: "2個",
  },
  facebook: {
    name: "Facebook",
    tone: "自然な会話調",
    length: "200〜400字",
    hashtagCount: "0個（ハッシュタグなし）",
  },
  instagram: {
    name: "Instagram",
    tone: "感情に訴えるキャプション",
    length: "150〜300字",
    hashtagCount: "10個",
  },
};

// 単一プラットフォームのリライトを実行
export async function rewriteForPlatform(
  articleTitle: string,
  articleBody: string,
  platform: Platform
): Promise<RewriteResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "環境変数 ANTHROPIC_API_KEY が設定されていません。設定ページで確認してください。"
    );
  }

  const config = PLATFORM_CONFIG[platform];
  const anthropic = new Anthropic({ apiKey });

  const systemPrompt = `あなたは日本語コンテンツのリライト専門家です。
以下の記事を${config.name}向けにリライトしてください。
トーン：${config.tone}
文字数：${config.length}
ハッシュタグ：${config.hashtagCount}

必ず以下のJSON形式のみで返答してください。JSON以外のテキストは含めないでください：
{"title": "リライト後のタイトル", "body": "リライト後の本文", "hashtags": "ハッシュタグ（カンマ区切り）"}`;

  const userMessage = `元記事タイトル：${articleTitle}\n\n元記事本文：\n${articleBody}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: userMessage }],
      system: systemPrompt,
    });

    // レスポンスからテキストを取得
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude APIからテキストレスポンスが取得できませんでした");
    }

    // JSONパース
    const parsed = JSON.parse(textBlock.text);

    return {
      platform,
      title: parsed.title || articleTitle,
      body: parsed.body || "",
      hashtags: parsed.hashtags || "",
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `${config.name}向けリライトのJSONパースに失敗しました。再試行してください。`
      );
    }
    throw error;
  }
}

// 全プラットフォーム一括リライト
export async function rewriteAllPlatforms(
  articleTitle: string,
  articleBody: string
): Promise<RewriteResult[]> {
  const platforms: Platform[] = [
    "note",
    "ameblo",
    "linkedin",
    "x",
    "facebook",
    "instagram",
  ];

  // 並列で全プラットフォーム分をリライト
  const results = await Promise.allSettled(
    platforms.map((platform) =>
      rewriteForPlatform(articleTitle, articleBody, platform)
    )
  );

  // 成功分のみ返却（失敗分はログに出力）
  const successResults: RewriteResult[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successResults.push(result.value);
    } else {
      console.error(
        `${platforms[index]}向けリライト失敗:`,
        result.reason
      );
    }
  });

  return successResults;
}

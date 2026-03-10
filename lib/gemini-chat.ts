import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "./db";
import {
  keywords,
  ownedSites,
  suggestAdvice,
  suggestHistory,
  rankingHistory,
  trackedUrls,
  searchResults,
  chatMemories,
  ownedSiteKeywords,
} from "./schema";
import { eq, desc } from "drizzle-orm";

// チャットメッセージの型
interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

// AI応答の型
export interface ChatResponse {
  reply: string;
  memory: string | null; // 学習すべき情報があればここに
}

/**
 * DB内のデータを取得してコンテキストテキストを構築
 */
async function buildContextFromDB(): Promise<string> {
  const sections: string[] = [];

  // キーワード一覧
  try {
    const kws = await db.query.keywords.findMany({
      where: eq(keywords.isActive, true),
    });
    if (kws.length > 0) {
      sections.push(
        `## 監視中のキーワード（${kws.length}件）\n${kws.map((k) => `- 「${k.keyword}」${k.memo ? `（メモ: ${k.memo}）` : ""}`).join("\n")}`
      );
    }
  } catch {}

  // 自社サイト一覧
  try {
    const sites = await db.query.ownedSites.findMany();
    if (sites.length > 0) {
      sections.push(
        `## 自社サイト一覧（${sites.length}件）\n${sites.map((s) => `- ${s.serviceName}: ${s.pageUrl}${s.memo ? ` （${s.memo}）` : ""}`).join("\n")}`
      );
    }
  } catch {}

  // 最新の順位データ（キーワード別に最新のみ）
  try {
    const urls = await db.query.trackedUrls.findMany({
      with: { keyword: true },
    });
    if (urls.length > 0) {
      const rankInfo: string[] = [];
      for (const url of urls.slice(0, 30)) {
        const latest = await db.query.rankingHistory.findFirst({
          where: eq(rankingHistory.url, url.url),
          orderBy: [desc(rankingHistory.checkedAt)],
        });
        if (latest) {
          const kwName = url.keyword?.keyword || "不明";
          rankInfo.push(
            `- 「${kwName}」→ ${url.label || url.url}: ${latest.rank === 101 ? "圏外" : latest.rank + "位"}`
          );
        }
      }
      if (rankInfo.length > 0) {
        sections.push(`## 最新の検索順位\n${rankInfo.join("\n")}`);
      }
    }
  } catch {}

  // サジェスト履歴（最新のネガティブサジェストワード）
  try {
    const suggests = await db.query.suggestHistory.findMany({
      orderBy: [desc(suggestHistory.checkedAt)],
      limit: 50,
      with: { keyword: true },
    });
    if (suggests.length > 0) {
      // キーワード別にグルーピング
      const byKw = new Map<string, { text: string; sentiment: string; position: number }[]>();
      for (const s of suggests) {
        const kwName = s.keyword?.keyword || "不明";
        if (!byKw.has(kwName)) byKw.set(kwName, []);
        byKw.get(kwName)!.push({ text: s.suggestText, sentiment: s.sentiment, position: s.position });
      }
      const suggestLines: string[] = [];
      byKw.forEach((items, kw) => {
        const negatives = items.filter(i => i.sentiment === "negative");
        const others = items.filter(i => i.sentiment !== "negative");
        suggestLines.push(`### 「${kw}」のサジェスト`);
        if (negatives.length > 0) {
          suggestLines.push(`ネガティブ: ${negatives.map(n => `"${n.text}"(${n.position}番目)`).join(", ")}`);
        }
        if (others.length > 0) {
          suggestLines.push(`その他: ${others.map(n => `"${n.text}"[${n.sentiment}]`).join(", ")}`);
        }
      });
      sections.push(`## サジェスト状況\n${suggestLines.join("\n")}`);
    }
  } catch {}

  // サジェスト対策アドバイス（全文表示）
  try {
    const advices = await db.query.suggestAdvice.findMany({
      orderBy: [desc(suggestAdvice.createdAt)],
      limit: 30,
      with: { keyword: true },
    });
    if (advices.length > 0) {
      const adviceLines = advices.map((a) => {
        const kwLabel = a.keyword?.keyword ? `「${a.keyword.keyword}」` : "";
        const suggestLabel = a.suggestText ? ` → サジェスト"${a.suggestText}"` : "";
        return `### [優先度:${a.priority}][状態:${a.status}] ${kwLabel}${suggestLabel}\n${a.advice}`;
      });
      sections.push(`## サジェスト対策AIアドバイス一覧\n以下はAIが生成した対策アドバイスの全内容です。ユーザーがこれらの内容について質問した場合は、アドバイスの内容を踏まえて具体的に深掘りしてください。\n\n${adviceLines.join("\n\n---\n\n")}`);
    }
  } catch {}

  // 自社サイト×キーワード紐付け
  try {
    const osk = await db.query.ownedSiteKeywords.findMany({
      with: { ownedSite: true, keyword: true, trackedUrl: true },
    });
    if (osk.length > 0) {
      const oskLines = osk.map((o) => {
        const siteName = o.ownedSite?.serviceName || "不明";
        const kwName = o.keyword?.keyword || "不明";
        const url = o.trackedUrl?.url || o.ownedSite?.pageUrl || "";
        return `- ${siteName} × 「${kwName}」 → ${url}`;
      });
      sections.push(`## 自社サイト×キーワード紐付け\n${oskLines.join("\n")}`);
    }
  } catch {}

  // ネガティブ記事情報（直近）
  try {
    const negatives = await db.query.searchResults.findMany({
      where: eq(searchResults.sentiment, "negative"),
      orderBy: [desc(searchResults.checkedAt)],
      limit: 20,
      with: { keyword: true },
    });
    if (negatives.length > 0) {
      sections.push(
        `## 検出済みネガティブ記事\n${negatives.map((n) => `- ${n.position}位「${n.title}」(${n.keyword?.keyword || "不明"}) URL: ${n.url}\n  判定理由: ${n.reason || "未記載"}\n  スニペット: ${n.snippet || "なし"}`).join("\n")}`
      );
    }
  } catch {}

  // メモリ
  try {
    const memories = await db.query.chatMemories.findMany({
      orderBy: [desc(chatMemories.createdAt)],
    });
    if (memories.length > 0) {
      sections.push(
        `## 学習済みメモリ（過去のやり取りからの学習内容）\n${memories.map((m) => `- ${m.content}`).join("\n")}`
      );
    }
  } catch {}

  return sections.join("\n\n");
}

/**
 * Gemini AIでチャット応答を生成
 */
export async function generateChatResponse(
  history: ChatHistoryItem[],
  userMessage: string
): Promise<ChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("環境変数 GEMINI_API_KEY が設定されていません");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  // DBコンテキストを構築
  const context = await buildContextFromDB();

  const systemPrompt = `あなたは「RankGuard」という逆SEO対策管理ツールに組み込まれたAIアシスタントです。
ユーザーはこのツールを使って、ネガティブな検索結果を押し下げ、ポジティブなコンテンツを上位表示させる逆SEO対策を行っています。

以下はユーザーのRankGuardに登録されている最新データです。このデータを踏まえて回答してください。

${context}

## あなたの役割
- 逆SEO・レピュテーション管理・サジェスト対策の専門家として回答
- RankGuardのデータ（サジェスト状況・AIアドバイス・順位・ネガティブ記事）すべてに基づいた具体的な回答を提供
- ユーザーが「アドバイスに対する質問」をした場合、上記のAIアドバイス内容を正確に参照し、そのアドバイスを深掘り・具体化・補足して回答
- 施策の提案は具体的（何を・どこで・どうするか・優先順位）に
- 日本語で回答

## アドバイスへの質問対応（重要）
ユーザーは「サジェスト対策AIアドバイス一覧」に記載された内容について質問してくることが多いです。
例えば：
- 「〇〇を強化って具体的にどうすればいい？」→ アドバイスの内容を特定し、その施策を具体的な手順に分解して回答
- 「〇〇という情報を載せているけど正解？」→ アドバイスの文脈を踏まえて、掲載情報の適切さを評価し改善案を提示
- 「どの対策から始めるべき？」→ 優先度・現在の順位・サジェスト状況を総合的に判断して推奨順を提示
- 「この対策で効果はある？」→ 一般的なSEO/逆SEO知見 + ユーザーの状況データを組み合わせて回答

## 重要なルール
回答は以下のJSON形式で返してください。JSONのみ返してください。
{"reply":"チャット返答（マークダウン形式可）","memory":"今回の会話で学習すべき重要な情報（ユーザーの業種、状況、好み等）があればここに記載。なければnull"}

memoryに記録する例：
- ユーザーの業種や会社の特徴
- 対策対象の人物名や企業の背景情報
- ユーザーが試した施策の結果
- ユーザーの好みや方針（例：「積極的なSNS運用は避けたい」）
- ユーザーが現在実施中の施策の内容

memoryに記録しないもの：
- 一般的な質問（例：「SEOとは？」）
- 既にデータベースにある情報の繰り返し`;

  // 会話履歴をテキストに変換
  const historyText = history
    .slice(-20) // 直近20メッセージまで
    .map((m) => `${m.role === "user" ? "ユーザー" : "アシスタント"}: ${m.content}`)
    .join("\n\n");

  const fullPrompt = historyText
    ? `${systemPrompt}\n\n## これまでの会話\n${historyText}\n\nユーザー: ${userMessage}`
    : `${systemPrompt}\n\nユーザー: ${userMessage}`;

  const result = await model.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();

  // JSONパース
  const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      reply: parsed.reply || "申し訳ありません、回答を生成できませんでした。",
      memory: parsed.memory || null,
    };
  } catch {
    // JSONパースに失敗した場合はテキストをそのまま返す
    return {
      reply: text,
      memory: null,
    };
  }
}

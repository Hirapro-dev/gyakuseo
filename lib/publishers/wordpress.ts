// WordPress REST API 連携

export interface WordPressPostResult {
  url: string;
  postId: number;
}

export async function publishToWordPress(
  title: string,
  body: string
): Promise<WordPressPostResult> {
  const siteUrl = process.env.WP_SITE_URL;
  const username = process.env.WP_USERNAME;
  const appPassword = process.env.WP_APP_PASSWORD;

  if (!siteUrl || !username || !appPassword) {
    throw new Error(
      "WordPress設定が不足しています（WP_SITE_URL, WP_USERNAME, WP_APP_PASSWORD）"
    );
  }

  // Basic認証ヘッダー生成
  const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");

  const response = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      title,
      content: body,
      status: "publish",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WordPress投稿エラー: ${response.status} - ${error}`);
  }

  const post = await response.json();
  return {
    url: post.link,
    postId: post.id,
  };
}

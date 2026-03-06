// Facebook Graph API 連携

export interface FacebookPostResult {
  postId: string;
  url: string;
}

export async function publishToFacebook(
  message: string
): Promise<FacebookPostResult> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    throw new Error(
      "Facebook設定が不足しています（FACEBOOK_PAGE_ID, FACEBOOK_ACCESS_TOKEN）"
    );
  }

  const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      access_token: accessToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Facebook投稿エラー: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const postId = result.id;

  return {
    postId,
    url: `https://www.facebook.com/${postId}`,
  };
}

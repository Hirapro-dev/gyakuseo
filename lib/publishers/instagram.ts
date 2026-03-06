// Instagram Graph API 連携（テキスト投稿はキャプション付きメディア投稿のみ対応）

export interface InstagramPostResult {
  mediaId: string;
  url: string;
}

export async function publishToInstagram(
  caption: string,
  imageUrl?: string
): Promise<InstagramPostResult> {
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN; // Instagram APIもFacebookトークンを使用

  if (!accountId || !accessToken) {
    throw new Error(
      "Instagram設定が不足しています（INSTAGRAM_BUSINESS_ACCOUNT_ID, FACEBOOK_ACCESS_TOKEN）"
    );
  }

  // Instagram Graph APIはメディア（画像）が必須
  // 画像URLが無い場合はエラー
  if (!imageUrl) {
    throw new Error(
      "Instagram投稿には画像URLが必要です。画像付きでの投稿をお試しください。"
    );
  }

  // Step 1: メディアコンテナ作成
  const containerUrl = `https://graph.facebook.com/v19.0/${accountId}/media`;
  const containerRes = await fetch(containerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    }),
  });

  if (!containerRes.ok) {
    const error = await containerRes.text();
    throw new Error(`Instagramメディア作成エラー: ${containerRes.status} - ${error}`);
  }

  const container = await containerRes.json();
  const containerId = container.id;

  // Step 2: メディア公開
  const publishUrl = `https://graph.facebook.com/v19.0/${accountId}/media_publish`;
  const publishRes = await fetch(publishUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  });

  if (!publishRes.ok) {
    const error = await publishRes.text();
    throw new Error(`Instagram公開エラー: ${publishRes.status} - ${error}`);
  }

  const result = await publishRes.json();
  return {
    mediaId: result.id,
    url: `https://www.instagram.com/p/${result.id}`,
  };
}

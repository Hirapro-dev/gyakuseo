// X (Twitter) API v2 連携
import crypto from "crypto";

export interface XPostResult {
  tweetId: string;
  url: string;
}

// OAuth 1.0a 署名生成
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
    )
    .join("&");

  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  return crypto
    .createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");
}

export async function publishToX(text: string): Promise<XPostResult> {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error(
      "X API設定が不足しています（X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET）"
    );
  }

  const url = "https://api.twitter.com/2/tweets";
  const method = "POST";
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    apiSecret,
    accessSecret
  );

  const authHeader = `OAuth ${Object.entries({
    ...oauthParams,
    oauth_signature: signature,
  })
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}="${encodeURIComponent(value)}"`
    )
    .join(", ")}`;

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`X投稿エラー: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const tweetId = result.data.id;

  return {
    tweetId,
    url: `https://twitter.com/i/web/status/${tweetId}`,
  };
}

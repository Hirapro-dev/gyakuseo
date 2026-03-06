# 逆SEO対策管理ツール

検索順位の監視・ネガティブURL対策を管理するフルスタックWebアプリケーションです。

## 技術スタック

- **フロントエンド**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **データベース**: Neon (PostgreSQL)
- **ORM**: Drizzle ORM
- **デプロイ**: Vercel
- **順位取得API**: Google Custom Search API
- **定期実行**: Vercel Cron Jobs（毎日AM9時 JST）
- **グラフ**: Recharts

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Neonデータベースの作成

1. [Neon](https://neon.tech/) にアクセスしてアカウントを作成
2. 新しいプロジェクトを作成
3. データベースの接続URLをコピー

### 3. Google Custom Search APIの設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. Custom Search API を有効化
3. APIキーを作成
4. [Programmable Search Engine](https://programmablesearchengine.google.com/) でカスタム検索エンジンを作成
5. 検索エンジンID（cx）をコピー

### 4. 環境変数の設定

`.env.local` ファイルを作成し、以下の環境変数を設定:

```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
GOOGLE_API_KEY=your-google-api-key
GOOGLE_CX=your-custom-search-engine-id
CRON_SECRET=your-random-secret-token
```

### 5. データベースのマイグレーション

```bash
npm run db:push
```

### 6. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 にアクセスしてアプリケーションを確認できます。

## Vercelへのデプロイ

### 1. Vercelプロジェクトの作成

```bash
npx vercel
```

### 2. 環境変数の設定

Vercelのダッシュボードで以下の環境変数を設定:

- `DATABASE_URL`
- `GOOGLE_API_KEY`
- `GOOGLE_CX`
- `CRON_SECRET`

### 3. デプロイ

```bash
npx vercel --prod
```

## Cron設定

`vercel.json` で毎日UTC 0:00（JST 9:00）に自動計測が実行されます。
`CRON_SECRET` 環境変数を設定することで、不正アクセスを防止しています。

## API制限について

Google Custom Search APIは1日100クエリまで無料です。
Cron実行時はアクティブなキーワード1つにつき1リクエストを消費します。
キーワード数が多い場合は、Google Cloud Consoleで有料プランにアップグレードしてください。

## 主な機能

- **ダッシュボード**: キーワードごとのネガティブURL順位一覧とグラフ表示
- **キーワード管理**: 監視キーワードのCRUD操作
- **URL管理**: ネガティブ/ポジティブURLの登録・管理
- **順位計測**: 手動計測ボタンと毎日の自動計測
- **順位推移グラフ**: Rechartsによる折れ線グラフ（Y軸反転）

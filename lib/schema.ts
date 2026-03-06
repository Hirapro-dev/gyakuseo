import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 監視キーワードテーブル
export const keywords = pgTable("keywords", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull(),
  memo: text("memo"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 管理URLテーブル
export const trackedUrls = pgTable("tracked_urls", {
  id: serial("id").primaryKey(),
  keywordId: integer("keyword_id")
    .references(() => keywords.id, { onDelete: "cascade" })
    .notNull(),
  url: text("url").notNull(),
  type: text("type", { enum: ["negative", "positive"] }).notNull(),
  label: text("label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 順位履歴テーブル
export const rankingHistory = pgTable("ranking_history", {
  id: serial("id").primaryKey(),
  keywordId: integer("keyword_id")
    .references(() => keywords.id, { onDelete: "cascade" })
    .notNull(),
  url: text("url").notNull(),
  rank: integer("rank").notNull(),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

// 記事マスタテーブル
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  keywordId: integer("keyword_id").references(() => keywords.id, {
    onDelete: "set null",
  }),
  status: text("status", { enum: ["draft", "published"] })
    .default("draft")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AIリライト済み記事テーブル
export const rewrittenArticles = pgTable("rewritten_articles", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id")
    .references(() => articles.id, { onDelete: "cascade" })
    .notNull(),
  platform: text("platform", {
    enum: ["note", "ameblo", "linkedin", "x", "facebook", "instagram"],
  }).notNull(),
  rewrittenTitle: text("rewritten_title").notNull(),
  rewrittenBody: text("rewritten_body").notNull(),
  hashtags: text("hashtags"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 自社サイト管理テーブル
export const ownedSites = pgTable("owned_sites", {
  id: serial("id").primaryKey(),
  serviceName: text("service_name").notNull(), // サービス名・SNS名
  pageUrl: text("page_url").notNull(), // 表示ページURL
  loginUrl: text("login_url"), // ログインページURL
  loginId: text("login_id"), // ログインID
  loginPassword: text("login_password"), // ログインパスワード
  memo: text("memo"), // 詳細・メモ
  trackedUrlId: integer("tracked_url_id").references(() => trackedUrls.id, {
    onDelete: "set null",
  }), // URL管理との連携ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 投稿ログテーブル
export const publishLogs = pgTable("publish_logs", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id")
    .references(() => articles.id, { onDelete: "cascade" })
    .notNull(),
  platform: text("platform").notNull(),
  status: text("status", {
    enum: ["success", "failed", "pending", "manual"],
  }).notNull(),
  publishedUrl: text("published_url"),
  errorMessage: text("error_message"),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
});

// リレーション定義
export const keywordsRelations = relations(keywords, ({ many }) => ({
  trackedUrls: many(trackedUrls),
  rankingHistory: many(rankingHistory),
  articles: many(articles),
}));

export const trackedUrlsRelations = relations(trackedUrls, ({ one, many }) => ({
  keyword: one(keywords, {
    fields: [trackedUrls.keywordId],
    references: [keywords.id],
  }),
  ownedSites: many(ownedSites),
}));

export const rankingHistoryRelations = relations(rankingHistory, ({ one }) => ({
  keyword: one(keywords, {
    fields: [rankingHistory.keywordId],
    references: [keywords.id],
  }),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  keyword: one(keywords, {
    fields: [articles.keywordId],
    references: [keywords.id],
  }),
  rewrittenArticles: many(rewrittenArticles),
  publishLogs: many(publishLogs),
}));

export const rewrittenArticlesRelations = relations(
  rewrittenArticles,
  ({ one }) => ({
    article: one(articles, {
      fields: [rewrittenArticles.articleId],
      references: [articles.id],
    }),
  })
);

export const ownedSitesRelations = relations(ownedSites, ({ one }) => ({
  trackedUrl: one(trackedUrls, {
    fields: [ownedSites.trackedUrlId],
    references: [trackedUrls.id],
  }),
}));

export const publishLogsRelations = relations(publishLogs, ({ one }) => ({
  article: one(articles, {
    fields: [publishLogs.articleId],
    references: [articles.id],
  }),
}));

// 型定義のエクスポート
export type Keyword = typeof keywords.$inferSelect;
export type NewKeyword = typeof keywords.$inferInsert;
export type TrackedUrl = typeof trackedUrls.$inferSelect;
export type NewTrackedUrl = typeof trackedUrls.$inferInsert;
export type RankingHistory = typeof rankingHistory.$inferSelect;
export type NewRankingHistory = typeof rankingHistory.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type RewrittenArticle = typeof rewrittenArticles.$inferSelect;
export type NewRewrittenArticle = typeof rewrittenArticles.$inferInsert;
export type PublishLog = typeof publishLogs.$inferSelect;
export type NewPublishLog = typeof publishLogs.$inferInsert;
export type OwnedSite = typeof ownedSites.$inferSelect;
export type NewOwnedSite = typeof ownedSites.$inferInsert;

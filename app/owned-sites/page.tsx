"use client";

import { useState, useEffect, useCallback } from "react";
import type { OwnedSite, TrackedUrl, Keyword, RankingHistory } from "@/lib/schema";

// 連携先のtrackedUrl情報を含む型
interface OwnedSiteWithRelation extends OwnedSite {
  trackedUrl?: TrackedUrl & {
    keyword?: Keyword;
  };
}

export default function OwnedSitesPage() {
  const [sites, setSites] = useState<OwnedSiteWithRelation[]>([]);
  const [trackedUrls, setTrackedUrls] = useState<(TrackedUrl & { keyword?: Keyword })[]>([]);
  const [rankingData, setRankingData] = useState<RankingHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // フォーム状態
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    serviceName: "",
    pageUrl: "",
    loginUrl: "",
    loginId: "",
    loginPassword: "",
    memo: "",
    trackedUrlId: "" as string | number,
  });
  const [submitting, setSubmitting] = useState(false);

  // パスワード表示切替
  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());

  // データ取得
  const fetchData = useCallback(async () => {
    try {
      const [sitesRes, urlsRes] = await Promise.all([
        fetch("/api/owned-sites"),
        fetch("/api/urls"),
      ]);

      const sitesData: OwnedSiteWithRelation[] = await sitesRes.json();
      const urlsData: (TrackedUrl & { keyword?: Keyword })[] = await urlsRes.json();

      setSites(sitesData);
      // ポジティブURLのみフィルタ（自社サイト連携用）
      setTrackedUrls(urlsData);

      // 順位データも取得
      const kwIds = new Set(urlsData.map((u) => u.keywordId));
      const allHistory: RankingHistory[] = [];
      await Promise.all(
        Array.from(kwIds).map(async (kwId) => {
          const rankRes = await fetch(`/api/rankings?keywordId=${kwId}&limit=200`);
          const rankData: RankingHistory[] = await rankRes.json();
          allHistory.push(...rankData);
        })
      );
      setRankingData(allHistory);
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 連携URLの最新順位を取得
  const getLinkedRank = (trackedUrlId: number | null): number | null => {
    if (!trackedUrlId) return null;
    const linkedUrl = trackedUrls.find((u) => u.id === trackedUrlId);
    if (!linkedUrl) return null;

    const history = rankingData
      .filter((h) => h.url === linkedUrl.url && h.keywordId === linkedUrl.keywordId)
      .sort(
        (a, b) =>
          new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
      );

    return history[0]?.rank ?? null;
  };

  // フォームリセット
  const resetForm = () => {
    setFormData({
      serviceName: "",
      pageUrl: "",
      loginUrl: "",
      loginId: "",
      loginPassword: "",
      memo: "",
      trackedUrlId: "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  // 編集モード開始
  const startEdit = (site: OwnedSiteWithRelation) => {
    setFormData({
      serviceName: site.serviceName,
      pageUrl: site.pageUrl,
      loginUrl: site.loginUrl || "",
      loginId: site.loginId || "",
      loginPassword: site.loginPassword || "",
      memo: site.memo || "",
      trackedUrlId: site.trackedUrlId || "",
    });
    setEditingId(site.id);
    setShowForm(true);
  };

  // 追加・更新
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.serviceName.trim() || !formData.pageUrl.trim()) return;

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        trackedUrlId: formData.trackedUrlId ? Number(formData.trackedUrlId) : null,
        ...(editingId ? { id: editingId } : {}),
      };

      const res = await fetch("/api/owned-sites", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        resetForm();
        await fetchData();
      } else {
        const error = await res.json();
        alert(`エラー: ${error.error}`);
      }
    } catch (error) {
      console.error("保存エラー:", error);
      alert("保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  // 削除
  const handleDelete = async (id: number) => {
    if (!confirm("このサイト情報を削除しますか？")) return;

    try {
      const res = await fetch(`/api/owned-sites?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchData();
      } else {
        const error = await res.json();
        alert(`削除エラー: ${error.error}`);
      }
    } catch (error) {
      console.error("削除エラー:", error);
    }
  };

  // パスワード表示切替
  const togglePasswordVisibility = (id: number) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 順位バッジ
  const RankBadge = ({ rank }: { rank: number | null }) => {
    if (rank === null) return <span className="text-xs text-gray-400">未連携</span>;
    if (rank === 101) return <span className="text-xs text-gray-400">圏外</span>;

    let color = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    if (rank <= 3) color = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    else if (rank <= 10) color = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    else if (rank <= 30) color = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${color}`}>
        {rank}位
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">自社サイト管理</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            ポジティブ施策で作成した自社サイト・SNSアカウントを一元管理
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm && !editingId) {
              resetForm();
            } else {
              resetForm();
              setShowForm(true);
            }
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-navy-950 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          新規登録
        </button>
      </div>

      {/* 登録・編集フォーム */}
      {showForm && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 p-6">
          <h2 className="text-lg font-bold mb-4">
            {editingId ? "サイト情報を編集" : "サイトを登録"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* サービス名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  サービス名・SNS名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.serviceName}
                  onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                  placeholder="例: note, Ameblo, X, WordPress..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  required
                />
              </div>

              {/* 表示ページURL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  表示ページURL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={formData.pageUrl}
                  onChange={(e) => setFormData({ ...formData, pageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  required
                />
              </div>

              {/* ログインページURL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ログインページURL
                </label>
                <input
                  type="url"
                  value={formData.loginUrl}
                  onChange={(e) => setFormData({ ...formData, loginUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>

              {/* ログインID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ログインID
                </label>
                <input
                  type="text"
                  value={formData.loginId}
                  onChange={(e) => setFormData({ ...formData, loginId: e.target.value })}
                  placeholder="ユーザー名 or メールアドレス"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>

              {/* ログインパスワード */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ログインパスワード
                </label>
                <input
                  type="password"
                  value={formData.loginPassword}
                  onChange={(e) => setFormData({ ...formData, loginPassword: e.target.value })}
                  placeholder="パスワード"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>

              {/* URL管理 連携ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL管理 連携ID
                </label>
                <select
                  value={formData.trackedUrlId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      trackedUrlId: e.target.value ? parseInt(e.target.value) : "",
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  <option value="">連携なし</option>
                  {trackedUrls.map((u) => (
                    <option key={u.id} value={u.id}>
                      ID:{u.id} | {u.keyword?.keyword || "不明"} | {u.label || u.url}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  URL管理ページで登録済みのURLと連携し、順位を自動取得できます
                </p>
              </div>
            </div>

            {/* 詳細・メモ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                詳細・メモ
              </label>
              <textarea
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                placeholder="サイトに関するメモ..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-navy-950 rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? "保存中..." : editingId ? "更新" : "登録"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border border-gray-300 dark:border-navy-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-800 rounded-lg text-sm font-medium transition-colors"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* サイト一覧 */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-navy-700">
          <h2 className="text-lg font-bold">
            登録済みサイト ({sites.length}件)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-navy-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  サービス名
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  表示ページ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ログインページ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ログインID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  パスワード
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  詳細
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  連携ID
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  表示順位
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-navy-950 divide-y divide-gray-200 dark:divide-gray-700">
              {sites.map((site) => {
                const linkedRank = getLinkedRank(site.trackedUrlId);

                return (
                  <tr
                    key={site.id}
                    className="hover:bg-gray-50 dark:hover:bg-navy-900/50"
                  >
                    {/* サービス名 */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {site.serviceName}
                      </span>
                    </td>

                    {/* 表示ページ */}
                    <td className="px-4 py-4">
                      <a
                        href={site.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block max-w-[200px]"
                      >
                        {site.pageUrl}
                      </a>
                    </td>

                    {/* ログインページ */}
                    <td className="px-4 py-4">
                      {site.loginUrl ? (
                        <a
                          href={site.loginUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block max-w-[200px]"
                        >
                          {site.loginUrl}
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* ログインID */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {site.loginId || <span className="text-xs text-gray-400">-</span>}
                      </span>
                    </td>

                    {/* パスワード */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {site.loginPassword ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-900 dark:text-white font-mono">
                            {visiblePasswords.has(site.id)
                              ? site.loginPassword
                              : "••••••••"}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(site.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            title={visiblePasswords.has(site.id) ? "非表示にする" : "表示する"}
                          >
                            {visiblePasswords.has(site.id) ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* 詳細 */}
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-300 truncate block max-w-[150px]">
                        {site.memo || <span className="text-xs text-gray-400">-</span>}
                      </span>
                    </td>

                    {/* 連携ID */}
                    <td className="px-4 py-4 text-center">
                      {site.trackedUrlId ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-200 text-xs font-mono font-bold">
                          #{site.trackedUrlId}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* 表示順位 */}
                    <td className="px-4 py-4 text-center">
                      <RankBadge rank={linkedRank} />
                    </td>

                    {/* 操作 */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => startEdit(site)}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(site.id)}
                          className="text-red-600 dark:text-red-400 hover:underline text-sm"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sites.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    サイトが登録されていません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

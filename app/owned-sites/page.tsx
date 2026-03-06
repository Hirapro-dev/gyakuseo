"use client";

import { useState, useEffect, useCallback } from "react";
import type { OwnedSite, TrackedUrl, Keyword, RankingHistory, OwnedSiteKeyword } from "@/lib/schema";

// 中間テーブル付きの型
interface OwnedSiteKeywordWithRelation extends OwnedSiteKeyword {
  keyword?: Keyword;
  trackedUrl?: TrackedUrl;
}

interface OwnedSiteWithRelation extends OwnedSite {
  ownedSiteKeywords: OwnedSiteKeywordWithRelation[];
}

// フォーム内のキーワードリンク
interface KeywordLinkForm {
  keywordId: number;
  trackedUrlId: number | null;
}

export default function OwnedSitesPage() {
  const [sites, setSites] = useState<OwnedSiteWithRelation[]>([]);
  const [allKeywords, setAllKeywords] = useState<Keyword[]>([]);
  const [trackedUrls, setTrackedUrls] = useState<(TrackedUrl & { keyword?: Keyword })[]>([]);
  const [rankingData, setRankingData] = useState<RankingHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // 各行で選択中のキーワードID（プルダウン切替用）
  const [selectedKeywordPerSite, setSelectedKeywordPerSite] = useState<Record<number, number>>({});

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
  });
  const [formKeywordLinks, setFormKeywordLinks] = useState<KeywordLinkForm[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // パスワード表示切替（一覧テーブル用）
  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());
  // フォームのパスワード表示切替
  const [formPasswordVisible, setFormPasswordVisible] = useState(false);
  // コピー完了表示（"siteId-field"をキーとして一時的に保持）
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // データ取得
  const fetchData = useCallback(async () => {
    try {
      const [sitesRes, kwRes, urlsRes] = await Promise.all([
        fetch("/api/owned-sites"),
        fetch("/api/keywords"),
        fetch("/api/urls"),
      ]);

      const sitesData: OwnedSiteWithRelation[] = await sitesRes.json();
      const kwData: Keyword[] = await kwRes.json();
      const urlsData: (TrackedUrl & { keyword?: Keyword })[] = await urlsRes.json();

      setSites(sitesData);
      setAllKeywords(kwData);
      setTrackedUrls(urlsData);

      // 各サイトのデフォルト選択キーワードを設定
      const defaults: Record<number, number> = {};
      sitesData.forEach((site) => {
        if (site.ownedSiteKeywords.length > 0) {
          defaults[site.id] = site.ownedSiteKeywords[0].keywordId;
        }
      });
      setSelectedKeywordPerSite((prev) => ({ ...defaults, ...prev }));

      // 順位データ取得
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

  // 選択中のキーワードに紐づくtrackedUrlの順位を取得
  const getLinkedRank = (
    site: OwnedSiteWithRelation,
    selectedKwId: number | undefined
  ): number | null => {
    if (!selectedKwId) return null;

    const link = site.ownedSiteKeywords.find(
      (osk) => osk.keywordId === selectedKwId
    );
    if (!link || !link.trackedUrlId) return null;

    const linkedUrl = trackedUrls.find((u) => u.id === link.trackedUrlId);
    if (!linkedUrl) return null;

    const history = rankingData
      .filter(
        (h) => h.url === linkedUrl.url && h.keywordId === linkedUrl.keywordId
      )
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
    });
    setFormKeywordLinks([]);
    setEditingId(null);
    setShowForm(false);
    setFormPasswordVisible(false);
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
    });
    setFormKeywordLinks(
      site.ownedSiteKeywords.map((osk) => ({
        keywordId: osk.keywordId,
        trackedUrlId: osk.trackedUrlId,
      }))
    );
    setEditingId(site.id);
    setShowForm(true);
  };

  // キーワードリンク追加
  const addKeywordLink = () => {
    setFormKeywordLinks([...formKeywordLinks, { keywordId: 0, trackedUrlId: null }]);
  };

  // キーワードリンク削除
  const removeKeywordLink = (index: number) => {
    setFormKeywordLinks(formKeywordLinks.filter((_, i) => i !== index));
  };

  // キーワードリンク更新（複数フィールドを同時に更新可能）
  const updateKeywordLink = (index: number, updates: Partial<KeywordLinkForm>) => {
    setFormKeywordLinks((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  // 選択済みキーワードに対応するtrackedUrlsをフィルタ
  const getTrackedUrlsForKeyword = (keywordId: number) => {
    return trackedUrls.filter((u) => u.keywordId === keywordId);
  };

  // 追加・更新
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.serviceName.trim() || !formData.pageUrl.trim()) return;

    setSubmitting(true);
    try {
      const validLinks = formKeywordLinks.filter((l) => l.keywordId > 0);

      const payload = {
        ...formData,
        keywordLinks: validLinks,
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

  // クリップボードにコピー
  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // フォールバック
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    }
  };

  // パスワード表示切替
  const togglePasswordVisibility = (id: number) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  const inputClass = "w-full px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500";

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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  サービス名・SNS名 <span className="text-red-500">*</span>
                </label>
                <input type="text" value={formData.serviceName}
                  onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                  placeholder="例: note, Ameblo, X, WordPress..." className={inputClass} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  表示ページURL <span className="text-red-500">*</span>
                </label>
                <input type="url" value={formData.pageUrl}
                  onChange={(e) => setFormData({ ...formData, pageUrl: e.target.value })}
                  placeholder="https://..." className={inputClass} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ログインページURL
                </label>
                <input type="url" value={formData.loginUrl}
                  onChange={(e) => setFormData({ ...formData, loginUrl: e.target.value })}
                  placeholder="https://..." className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ログインID
                </label>
                <input type="text" value={formData.loginId}
                  onChange={(e) => setFormData({ ...formData, loginId: e.target.value })}
                  placeholder="ユーザー名 or メールアドレス" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ログインパスワード
                </label>
                <div className="relative">
                  <input
                    type={formPasswordVisible ? "text" : "password"}
                    value={formData.loginPassword}
                    onChange={(e) => setFormData({ ...formData, loginPassword: e.target.value })}
                    placeholder="パスワード"
                    className={inputClass + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setFormPasswordVisible(!formPasswordVisible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    title={formPasswordVisible ? "パスワードを隠す" : "パスワードを表示"}
                  >
                    {formPasswordVisible ? (
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
              </div>
            </div>

            {/* キーワード連携（複数追加可能） */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  キーワード連携
                </label>
                <button type="button" onClick={addKeywordLink}
                  className="flex items-center gap-1 text-xs text-accent-600 dark:text-accent-400 hover:underline">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  キーワードを追加
                </button>
              </div>
              {formKeywordLinks.length === 0 && (
                <p className="text-xs text-gray-400">キーワードが未選択です。「キーワードを追加」から追加してください。</p>
              )}
              <div className="space-y-2">
                {formKeywordLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={link.keywordId || ""}
                      onChange={(e) => {
                        const kwId = parseInt(e.target.value) || 0;
                        updateKeywordLink(idx, { keywordId: kwId, trackedUrlId: null });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                    >
                      <option value="">キーワードを選択</option>
                      {allKeywords.map((kw) => (
                        <option key={kw.id} value={kw.id}>{kw.keyword}</option>
                      ))}
                    </select>
                    <select
                      value={link.trackedUrlId || ""}
                      onChange={(e) =>
                        updateKeywordLink(idx, { trackedUrlId: e.target.value ? parseInt(e.target.value) : null })
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                    >
                      <option value="">URL連携なし</option>
                      {link.keywordId > 0 &&
                        getTrackedUrlsForKeyword(link.keywordId).map((u) => (
                          <option key={u.id} value={u.id}>#{u.id} | {u.label || u.url}</option>
                        ))}
                    </select>
                    <button type="button" onClick={() => removeKeywordLink(idx)}
                      className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-300">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                複合キーワード（例:「植田雄輝 逮捕」）はキーワード管理ページでそのまま登録できます
              </p>
            </div>

            {/* 詳細・メモ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                詳細・メモ
              </label>
              <textarea value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                placeholder="サイトに関するメモ..." rows={3} className={inputClass} />
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={submitting}
                className="px-6 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-navy-950 rounded-lg text-sm font-medium transition-colors">
                {submitting ? "保存中..." : editingId ? "更新" : "登録"}
              </button>
              <button type="button" onClick={resetForm}
                className="px-6 py-2 border border-gray-300 dark:border-navy-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-800 rounded-lg text-sm font-medium transition-colors">
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* サイト一覧 */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-navy-700">
          <h2 className="text-lg font-bold">登録済みサイト ({sites.length}件)</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-navy-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">サービス名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">表示ページ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ログイン</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID / パスワード</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">詳細</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">キーワード / 順位</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-navy-950 divide-y divide-gray-200 dark:divide-gray-700">
              {sites.map((site) => {
                const selectedKwId = selectedKeywordPerSite[site.id];
                const linkedRank = getLinkedRank(site, selectedKwId);
                const selectedLink = site.ownedSiteKeywords.find(
                  (osk) => osk.keywordId === selectedKwId
                );

                return (
                  <tr key={site.id} className="hover:bg-gray-50 dark:hover:bg-navy-900/50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{site.serviceName}</span>
                    </td>
                    <td className="px-4 py-4">
                      <a href={site.pageUrl} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block max-w-[180px]">
                        {site.pageUrl}
                      </a>
                    </td>
                    <td className="px-4 py-4">
                      {site.loginUrl ? (
                        <a href={site.loginUrl} target="_blank" rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block max-w-[180px]">
                          {site.loginUrl}
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1.5">
                        {/* ログインID */}
                        {site.loginId ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-gray-900 dark:text-white font-mono">{site.loginId}</span>
                            <button
                              onClick={() => handleCopy(site.loginId!, `${site.id}-id`)}
                              className="p-0.5 text-gray-400 hover:text-accent-400 transition-colors"
                              title="IDをコピー"
                            >
                              {copiedKey === `${site.id}-id` ? (
                                <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                                </svg>
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                        {/* パスワード */}
                        {site.loginPassword ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-gray-900 dark:text-white font-mono">
                              {visiblePasswords.has(site.id) ? site.loginPassword : "••••••••"}
                            </span>
                            <button onClick={() => togglePasswordVisibility(site.id)}
                              className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                              title={visiblePasswords.has(site.id) ? "パスワードを隠す" : "パスワードを表示"}
                            >
                              {visiblePasswords.has(site.id) ? (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => handleCopy(site.loginPassword!, `${site.id}-pw`)}
                              className="p-0.5 text-gray-400 hover:text-accent-400 transition-colors"
                              title="パスワードをコピー"
                            >
                              {copiedKey === `${site.id}-pw` ? (
                                <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                                </svg>
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-300 truncate block max-w-[120px]">
                        {site.memo || <span className="text-xs text-gray-400">-</span>}
                      </span>
                    </td>
                    {/* キーワード / 順位 */}
                    <td className="px-4 py-4">
                      {site.ownedSiteKeywords.length > 0 ? (
                        <div className="space-y-2">
                          <select
                            value={selectedKwId || ""}
                            onChange={(e) =>
                              setSelectedKeywordPerSite({
                                ...selectedKeywordPerSite,
                                [site.id]: parseInt(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-950 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent-500"
                          >
                            {site.ownedSiteKeywords.map((osk) => (
                              <option key={osk.keywordId} value={osk.keywordId}>
                                {osk.keyword?.keyword || `KW#${osk.keywordId}`}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center justify-center gap-2">
                            <RankBadge rank={linkedRank} />
                            {selectedLink?.trackedUrlId && (
                              <span className="text-[10px] text-gray-400">(#{selectedLink.trackedUrlId})</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 text-center block">未設定</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => startEdit(site)}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-sm">編集</button>
                        <button onClick={() => handleDelete(site.id)}
                          className="text-red-600 dark:text-red-400 hover:underline text-sm">削除</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sites.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
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

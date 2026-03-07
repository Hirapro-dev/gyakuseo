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

  // パスワード表示切替（一覧用）
  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());
  // フォームのパスワード表示切替
  const [formPasswordVisible, setFormPasswordVisible] = useState(false);
  // コピー完了表示
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

  // キーワードに紐づくtrackedUrlの順位を取得
  const getRankForLink = (
    osk: OwnedSiteKeywordWithRelation
  ): number | null => {
    if (!osk.trackedUrlId) return null;

    const linkedUrl = trackedUrls.find((u) => u.id === osk.trackedUrlId);
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
    if (rank === null) return <span className="text-xs text-gray-400">-</span>;
    if (rank === 101) return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 font-bold">圏外</span>;

    let color = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    if (rank <= 3) color = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    else if (rank <= 10) color = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    else if (rank <= 30) color = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
        {rank}位
      </span>
    );
  };

  // コピーアイコン
  const CopyButton = ({ text, copyKey }: { text: string; copyKey: string }) => (
    <button
      onClick={() => handleCopy(text, copyKey)}
      className="p-0.5 text-gray-400 hover:text-accent-400 transition-colors flex-shrink-0"
      title="コピー"
    >
      {copiedKey === copyKey ? (
        <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
        </svg>
      )}
    </button>
  );

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

      {/* 登録・編集モーダル */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* オーバーレイ */}
          <div className="absolute inset-0 bg-black/60" onClick={resetForm} />

          {/* モーダル本体 */}
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 shadow-2xl p-6">
            {/* 閉じるボタン */}
            <button
              onClick={resetForm}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

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

              <div className="flex gap-3 pt-2">
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
        </div>
      )}

      {/* サイト一覧（カード形式） */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold">登録済みサイト ({sites.length}件)</h2>

        {sites.length === 0 && (
          <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">サイトが登録されていません</p>
          </div>
        )}

        {sites.map((site) => (
          <div
            key={site.id}
            className="bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700 overflow-hidden"
          >
            {/* カードヘッダー: サービス名 + キーワード順位 + 操作ボタン */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-navy-800 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* サービス名 */}
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {site.serviceName}
                  </h3>
                  <a
                    href={site.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 dark:text-blue-400 hover:underline truncate max-w-[250px]"
                    title={site.pageUrl}
                  >
                    {site.pageUrl}
                  </a>
                </div>

                {/* キーワード × 順位 一覧（横並び） */}
                {site.ownedSiteKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {site.ownedSiteKeywords.map((osk) => {
                      const rank = getRankForLink(osk);
                      const kwName = osk.keyword?.keyword || `KW#${osk.keywordId}`;
                      return (
                        <div
                          key={osk.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700"
                        >
                          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
                            {kwName}
                          </span>
                          <RankBadge rank={rank} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">キーワード未設定</span>
                )}
              </div>

              {/* 操作ボタン */}
              <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                <button onClick={() => startEdit(site)}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  編集
                </button>
                <button onClick={() => handleDelete(site.id)}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  削除
                </button>
              </div>
            </div>

            {/* カード詳細: ログイン情報・メモなど */}
            <div className="px-5 py-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {/* ログインURL */}
              <div>
                <span className="text-xs text-gray-400 dark:text-gray-500 block mb-1">ログインURL</span>
                {site.loginUrl ? (
                  <a href={site.loginUrl} target="_blank" rel="noopener noreferrer"
                    className="text-blue-500 dark:text-blue-400 hover:underline text-xs break-all">
                    {site.loginUrl}
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                )}
              </div>

              {/* ログインID */}
              <div>
                <span className="text-xs text-gray-400 dark:text-gray-500 block mb-1">ログインID</span>
                {site.loginId ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-gray-900 dark:text-white font-mono break-all">{site.loginId}</span>
                    <CopyButton text={site.loginId} copyKey={`${site.id}-id`} />
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                )}
              </div>

              {/* パスワード */}
              <div>
                <span className="text-xs text-gray-400 dark:text-gray-500 block mb-1">パスワード</span>
                {site.loginPassword ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-gray-900 dark:text-white font-mono">
                      {visiblePasswords.has(site.id) ? site.loginPassword : "••••••••"}
                    </span>
                    <button onClick={() => togglePasswordVisibility(site.id)}
                      className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors flex-shrink-0"
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
                    <CopyButton text={site.loginPassword} copyKey={`${site.id}-pw`} />
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                )}
              </div>
            </div>

            {/* メモ（ある場合のみ） */}
            {site.memo && (
              <div className="px-5 py-2 border-t border-gray-100 dark:border-navy-800">
                <span className="text-xs text-gray-400 dark:text-gray-500">メモ: </span>
                <span className="text-xs text-gray-600 dark:text-gray-300">{site.memo}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

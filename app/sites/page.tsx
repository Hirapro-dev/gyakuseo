"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

// AI順位分析結果
interface RankAnalysis {
  trend: "up" | "down" | "stable" | "new";
  reason: string;
  advice: string;
  urgency: "high" | "medium" | "low";
}

export default function SitesPage() {
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

  // フィルター・ソート
  const [searchText, setSearchText] = useState("");
  const [keywordFilter, setKeywordFilter] = useState<number | "all">("all");
  const [sortKey, setSortKey] = useState<"createdAt" | "serviceName" | "bestRank">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // パスワード表示切替
  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());
  const [formPasswordVisible, setFormPasswordVisible] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ドメイン記事展開
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  // AI分析
  const [rankAnalysis, setRankAnalysis] = useState<Record<string, RankAnalysis>>({});
  const [analyzingKey, setAnalyzingKey] = useState<string | null>(null);

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
          const data: RankingHistory[] = await rankRes.json();
          allHistory.push(...data);
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

  // URLからドメイン抽出
  const getDomain = (url: string): string => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  };

  // 特定キーワードで同一ドメインの全ランクイン記事を取得
  const getDomainArticlesForKeyword = useCallback(
    (sitePageUrl: string, keywordId: number): { url: string; rank: number; title?: string }[] => {
      const siteDomain = getDomain(sitePageUrl);

      const latestByUrl = new Map<string, RankingHistory>();
      rankingData
        .filter((h) => h.keywordId === keywordId)
        .forEach((h) => {
          const existing = latestByUrl.get(h.url);
          if (!existing || new Date(h.checkedAt).getTime() > new Date(existing.checkedAt).getTime()) {
            latestByUrl.set(h.url, h);
          }
        });

      const articles: { url: string; rank: number; title?: string }[] = [];
      latestByUrl.forEach((h, url) => {
        if (getDomain(url) === siteDomain && h.rank <= 100) {
          const tracked = trackedUrls.find((u) => u.url === url && u.keywordId === keywordId);
          articles.push({ url, rank: h.rank, title: tracked?.label || undefined });
        }
      });

      articles.sort((a, b) => a.rank - b.rank);
      return articles;
    },
    [rankingData, trackedUrls]
  );

  // キーワードに紐づくtrackedUrlの順位を取得
  const getRankForLink = (osk: OwnedSiteKeywordWithRelation): number | null => {
    if (!osk.trackedUrlId) return null;
    const linkedUrl = trackedUrls.find((u) => u.id === osk.trackedUrlId);
    if (!linkedUrl) return null;

    const history = rankingData
      .filter((h) => h.url === linkedUrl.url && h.keywordId === linkedUrl.keywordId)
      .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());

    return history[0]?.rank ?? null;
  };

  // サイトの最良順位
  const getBestRankForSite = useCallback(
    (site: OwnedSiteWithRelation): number | null => {
      if (site.ownedSiteKeywords.length === 0) return null;
      const allRanks: number[] = [];

      site.ownedSiteKeywords.forEach((osk) => {
        const articles = getDomainArticlesForKeyword(site.pageUrl, osk.keywordId);
        if (articles.length > 0) {
          articles.forEach((a) => allRanks.push(a.rank));
        } else {
          const rank = getRankForLink(osk);
          if (rank !== null) allRanks.push(rank);
        }
      });

      if (allRanks.length === 0) return null;
      return Math.min(...allRanks);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trackedUrls, rankingData, getDomainArticlesForKeyword]
  );

  // ドメイン展開切替
  const toggleDomainExpand = (key: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // AI分析
  const handleAnalyzeRank = async (siteId: number, keywordId: number) => {
    const key = `${siteId}-${keywordId}`;
    if (rankAnalysis[key]) {
      setRankAnalysis((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    setAnalyzingKey(key);
    try {
      const res = await fetch("/api/rank-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownedSiteId: siteId, keywordId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`分析エラー: ${err.error || "不明なエラー"}`);
        return;
      }
      const data: RankAnalysis = await res.json();
      setRankAnalysis((prev) => ({ ...prev, [key]: data }));
    } catch {
      alert("AI分析に失敗しました");
    } finally {
      setAnalyzingKey(null);
    }
  };

  // フォームリセット
  const resetForm = () => {
    setFormData({ serviceName: "", pageUrl: "", loginUrl: "", loginId: "", loginPassword: "", memo: "" });
    setFormKeywordLinks([]);
    setEditingId(null);
    setShowForm(false);
    setFormPasswordVisible(false);
  };

  // 編集開始
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

  // キーワードリンク操作
  const addKeywordLink = () => {
    setFormKeywordLinks([...formKeywordLinks, { keywordId: 0, trackedUrlId: null }]);
  };

  const removeKeywordLink = (index: number) => {
    setFormKeywordLinks(formKeywordLinks.filter((_, i) => i !== index));
  };

  const updateKeywordLink = (index: number, updates: Partial<KeywordLinkForm>) => {
    setFormKeywordLinks((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const getTrackedUrlsForKeyword = (keywordId: number) => {
    return trackedUrls.filter((u) => u.keywordId === keywordId);
  };

  // 保存
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
    } catch {
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
      if (res.ok) await fetchData();
    } catch {
      alert("削除に失敗しました");
    }
  };

  // コピー
  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
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
    if (rank === 101) return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-bold">圏外</span>;

    let color = "bg-red-900/30 text-red-400";
    if (rank <= 3) color = "bg-green-900/30 text-green-400";
    else if (rank <= 10) color = "bg-blue-900/30 text-blue-400";
    else if (rank <= 30) color = "bg-yellow-900/30 text-yellow-400";

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
        {rank}位
      </span>
    );
  };

  // コピーボタン
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

  // フィルター+ソート
  const filteredSites = useMemo(() => {
    let result = sites;

    if (searchText) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (s) =>
          s.serviceName.toLowerCase().includes(q) ||
          s.pageUrl.toLowerCase().includes(q) ||
          (s.memo && s.memo.toLowerCase().includes(q))
      );
    }

    if (keywordFilter !== "all") {
      result = result.filter((s) =>
        s.ownedSiteKeywords.some((osk) => osk.keywordId === keywordFilter)
      );
    }

    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "serviceName":
          cmp = a.serviceName.localeCompare(b.serviceName, "ja");
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "bestRank": {
          const valA = getBestRankForSite(a) ?? 9999;
          const valB = getBestRankForSite(b) ?? 9999;
          cmp = valA - valB;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sites, searchText, keywordFilter, sortKey, sortDir, getBestRankForSite]);

  // 効果サマリー計算
  const effectSummary = useMemo(() => {
    let top10 = 0, top30 = 0, top100 = 0, out = 0, noData = 0;
    sites.forEach((site) => {
      const best = getBestRankForSite(site);
      if (best === null) noData++;
      else if (best <= 10) top10++;
      else if (best <= 30) top30++;
      else if (best <= 100) top100++;
      else out++;
    });
    return { total: sites.length, top10, top30, top100, out, noData };
  }, [sites, getBestRankForSite]);

  const inputClass = "w-full px-4 py-2 border border-navy-600 rounded-lg bg-navy-950 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500";
  const selectClass = "px-3 py-2 border border-navy-600 rounded-lg bg-navy-950 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">自社サイト管理</h1>
          <p className="text-sm text-muted mt-1">
            対策サイト・SNSアカウントの管理と効果分析
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-navy-950 rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          新規登録
        </button>
      </div>

      {/* 効果サマリー */}
      {sites.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="card p-3 border-none bg-navy-800">
            <div className="text-xs font-medium text-gray-400">登録数</div>
            <div className="text-2xl font-bold text-white">{effectSummary.total}</div>
          </div>
          <div className="card p-3 border-none bg-green-500/20">
            <div className="text-xs font-medium text-green-400">10位以内</div>
            <div className="text-2xl font-bold text-green-400">{effectSummary.top10}</div>
          </div>
          <div className="card p-3 border-none bg-blue-500/20">
            <div className="text-xs font-medium text-blue-400">11〜30位</div>
            <div className="text-2xl font-bold text-blue-400">{effectSummary.top30}</div>
          </div>
          <div className="card p-3 border-none bg-yellow-500/20">
            <div className="text-xs font-medium text-yellow-400">31〜100位</div>
            <div className="text-2xl font-bold text-yellow-400">{effectSummary.top100}</div>
          </div>
          <div className="card p-3 border-none bg-red-500/20">
            <div className="text-xs font-medium text-red-400">圏外</div>
            <div className="text-2xl font-bold text-red-400">{effectSummary.out}</div>
          </div>
          <div className="card p-3 border-none bg-gray-500/20">
            <div className="text-xs font-medium text-gray-400">データなし</div>
            <div className="text-2xl font-bold text-gray-400">{effectSummary.noData}</div>
          </div>
        </div>
      )}

      {/* 登録・編集モーダル */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={resetForm} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 bg-navy-900 rounded-xl border border-navy-700 shadow-2xl p-6">
            <button onClick={resetForm} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-200 hover:bg-navy-800 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-lg font-bold mb-4 text-foreground">
              {editingId ? "サイト情報を編集" : "サイトを登録"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    サービス名 <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={formData.serviceName}
                    onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                    placeholder="例: note, Ameblo, X..." className={inputClass} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    表示ページURL <span className="text-red-500">*</span>
                  </label>
                  <input type="url" value={formData.pageUrl}
                    onChange={(e) => setFormData({ ...formData, pageUrl: e.target.value })}
                    placeholder="https://..." className={inputClass} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">ログインURL</label>
                  <input type="url" value={formData.loginUrl}
                    onChange={(e) => setFormData({ ...formData, loginUrl: e.target.value })}
                    placeholder="https://..." className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">ログインID</label>
                  <input type="text" value={formData.loginId}
                    onChange={(e) => setFormData({ ...formData, loginId: e.target.value })}
                    placeholder="ユーザー名 or メールアドレス" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">パスワード</label>
                  <div className="relative">
                    <input
                      type={formPasswordVisible ? "text" : "password"}
                      value={formData.loginPassword}
                      onChange={(e) => setFormData({ ...formData, loginPassword: e.target.value })}
                      placeholder="パスワード"
                      className={inputClass + " pr-10"}
                    />
                    <button type="button" onClick={() => setFormPasswordVisible(!formPasswordVisible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        {formPasswordVisible ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        ) : (
                          <>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* キーワード連携 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">キーワード連携</label>
                  <button type="button" onClick={addKeywordLink}
                    className="flex items-center gap-1 text-xs text-accent-400 hover:underline">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    キーワードを追加
                  </button>
                </div>
                {formKeywordLinks.length === 0 && (
                  <p className="text-xs text-gray-400">キーワードが未選択です</p>
                )}
                <div className="space-y-2">
                  {formKeywordLinks.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={link.keywordId || ""}
                        onChange={(e) => updateKeywordLink(idx, { keywordId: parseInt(e.target.value) || 0, trackedUrlId: null })}
                        className={`flex-1 ${selectClass}`}
                      >
                        <option value="">キーワードを選択</option>
                        {allKeywords.map((kw) => (
                          <option key={kw.id} value={kw.id}>{kw.keyword}</option>
                        ))}
                      </select>
                      <select
                        value={link.trackedUrlId || ""}
                        onChange={(e) => updateKeywordLink(idx, { trackedUrlId: e.target.value ? parseInt(e.target.value) : null })}
                        className={`flex-1 ${selectClass}`}
                      >
                        <option value="">URL連携なし</option>
                        {link.keywordId > 0 &&
                          getTrackedUrlsForKeyword(link.keywordId).map((u) => (
                            <option key={u.id} value={u.id}>#{u.id} | {u.label || u.url}</option>
                          ))}
                      </select>
                      <button type="button" onClick={() => removeKeywordLink(idx)}
                        className="p-2 text-red-400 hover:text-red-300">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* メモ */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">メモ</label>
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
                  className="px-6 py-2 border border-navy-600 text-gray-300 hover:bg-navy-800 rounded-lg text-sm font-medium transition-colors">
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* フィルター・ソートバー */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="検索..."
          className="w-36 px-3 py-2 border border-navy-600 rounded-lg bg-navy-950 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
        />
        <select
          value={keywordFilter === "all" ? "all" : String(keywordFilter)}
          onChange={(e) => setKeywordFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          className={selectClass}
        >
          <option value="all">全キーワード</option>
          {allKeywords.map((kw) => (
            <option key={kw.id} value={kw.id}>{kw.keyword}</option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
          className={selectClass}
        >
          <option value="createdAt">作成日順</option>
          <option value="serviceName">名前順</option>
          <option value="bestRank">順位順</option>
        </select>
        <button
          onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
          className="px-3 py-2 border border-navy-600 rounded-lg bg-navy-950 text-white text-sm hover:bg-navy-800 transition-colors"
        >
          {sortDir === "asc" ? "▲" : "▼"}
        </button>
        <span className="text-xs text-muted ml-2">{filteredSites.length}件</span>
      </div>

      {/* サイト一覧 */}
      {filteredSites.length === 0 && (
        <div className="card p-12 text-center text-muted">
          {sites.length === 0 ? "サイトが登録されていません" : "条件に一致するサイトがありません"}
        </div>
      )}

      <div className="space-y-4">
        {filteredSites.map((site) => (
          <div key={site.id} className="card overflow-hidden">
            {/* カードヘッダー */}
            <div className="px-5 py-4 border-b border-navy-800 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-base font-bold text-foreground">{site.serviceName}</h3>
                  <a href={site.pageUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline truncate max-w-[250px]" title={site.pageUrl}>
                    {site.pageUrl}
                  </a>
                </div>

                {/* キーワード × 順位 */}
                {site.ownedSiteKeywords.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {site.ownedSiteKeywords.map((osk) => {
                        const kwName = osk.keyword?.keyword || `KW#${osk.keywordId}`;
                        const domainArticles = getDomainArticlesForKeyword(site.pageUrl, osk.keywordId);
                        const hasMultiple = domainArticles.length > 1;
                        const expandKey = `${site.id}-${osk.keywordId}`;
                        const isExpanded = expandedDomains.has(expandKey);

                        const bestRank = domainArticles.length > 0
                          ? Math.min(...domainArticles.map((a) => a.rank))
                          : getRankForLink(osk);

                        return (
                          <div key={osk.id} className="flex flex-col">
                            <div
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-950 border border-navy-700 ${hasMultiple ? "cursor-pointer hover:bg-navy-900 transition-colors" : ""}`}
                              onClick={() => hasMultiple && toggleDomainExpand(expandKey)}
                            >
                              <span className="text-sm font-medium text-gray-200 whitespace-nowrap">{kwName}</span>
                              {hasMultiple && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-900/30 text-purple-400 whitespace-nowrap">
                                  複数({domainArticles.length})
                                  <svg className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </span>
                              )}
                              <RankBadge rank={bestRank} />
                              {bestRank !== null && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleAnalyzeRank(site.id, osk.keywordId); }}
                                  disabled={analyzingKey === expandKey}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-900/30 text-indigo-400 hover:bg-indigo-800/40 transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                  {analyzingKey === expandKey ? (
                                    <>
                                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                      分析中
                                    </>
                                  ) : rankAnalysis[expandKey] ? "閉じる" : "AI分析"}
                                </button>
                              )}
                            </div>

                            {/* 複数記事展開 */}
                            {hasMultiple && isExpanded && (
                              <div className="mt-1 ml-2 space-y-1 border-l-2 border-purple-700 pl-3">
                                {domainArticles.map((article, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs py-1">
                                    <RankBadge rank={article.rank} />
                                    <a href={article.url} target="_blank" rel="noopener noreferrer"
                                      className="text-blue-400 hover:underline truncate max-w-[400px]" title={article.url}>
                                      {article.title || article.url}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* AI分析結果 */}
                            {rankAnalysis[expandKey] && (
                              <div className="mt-2 p-3 rounded-lg bg-indigo-950/30 border border-indigo-800 text-sm">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                    rankAnalysis[expandKey].trend === "up" ? "bg-green-900/30 text-green-400"
                                      : rankAnalysis[expandKey].trend === "down" ? "bg-red-900/30 text-red-400"
                                      : rankAnalysis[expandKey].trend === "new" ? "bg-blue-900/30 text-blue-400"
                                      : "bg-gray-800 text-gray-400"
                                  }`}>
                                    {rankAnalysis[expandKey].trend === "up" ? "↑ 上昇" : rankAnalysis[expandKey].trend === "down" ? "↓ 下降" : rankAnalysis[expandKey].trend === "new" ? "★ 新規" : "→ 安定"}
                                  </span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                    rankAnalysis[expandKey].urgency === "high" ? "bg-red-900/30 text-red-400"
                                      : rankAnalysis[expandKey].urgency === "medium" ? "bg-yellow-900/30 text-yellow-400"
                                      : "bg-green-900/30 text-green-400"
                                  }`}>
                                    {rankAnalysis[expandKey].urgency === "high" ? "緊急度: 高" : rankAnalysis[expandKey].urgency === "medium" ? "緊急度: 中" : "緊急度: 低"}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  <div>
                                    <span className="text-xs font-bold text-indigo-400 block mb-0.5">変動理由</span>
                                    <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{rankAnalysis[expandKey].reason}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-indigo-400 block mb-0.5">改善アドバイス</span>
                                    <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{rankAnalysis[expandKey].advice}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">キーワード未設定</span>
                )}
              </div>

              {/* 操作ボタン */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => startEdit(site)}
                  className="px-3 py-1.5 text-xs font-medium text-blue-400 border border-blue-700 rounded-lg hover:bg-blue-900/20 transition-colors">
                  編集
                </button>
                <button onClick={() => handleDelete(site.id)}
                  className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-700 rounded-lg hover:bg-red-900/20 transition-colors">
                  削除
                </button>
              </div>
            </div>

            {/* カード詳細 */}
            <div className="px-5 py-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-xs text-gray-500 block mb-1">ログインURL</span>
                {site.loginUrl ? (
                  <a href={site.loginUrl} target="_blank" rel="noopener noreferrer"
                    className="text-blue-400 hover:underline text-xs break-all">{site.loginUrl}</a>
                ) : <span className="text-xs text-gray-400">-</span>}
              </div>
              <div>
                <span className="text-xs text-gray-500 block mb-1">ログインID</span>
                {site.loginId ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-white font-mono break-all">{site.loginId}</span>
                    <CopyButton text={site.loginId} copyKey={`${site.id}-id`} />
                  </div>
                ) : <span className="text-xs text-gray-400">-</span>}
              </div>
              <div>
                <span className="text-xs text-gray-500 block mb-1">パスワード</span>
                {site.loginPassword ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-white font-mono">
                      {visiblePasswords.has(site.id) ? site.loginPassword : "••••••••"}
                    </span>
                    <button onClick={() => togglePasswordVisibility(site.id)}
                      className="p-0.5 text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        {visiblePasswords.has(site.id) ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        ) : (
                          <>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </>
                        )}
                      </svg>
                    </button>
                    <CopyButton text={site.loginPassword} copyKey={`${site.id}-pw`} />
                  </div>
                ) : <span className="text-xs text-gray-400">-</span>}
              </div>
            </div>

            {/* メモ */}
            {site.memo && (
              <div className="px-5 py-2 border-t border-navy-800">
                <span className="text-xs text-gray-500">メモ: </span>
                <span className="text-xs text-gray-300">{site.memo}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// セッション型
interface ChatSession {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// メッセージ型
interface ChatMessage {
  id: number;
  sessionId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  imageUrls?: string[]; // クライアント側のみ：画像プレビューURL
}

// メモリ型
interface ChatMemory {
  id: number;
  content: string;
  source: string | null;
  createdAt: string;
}

export default function ChatPage() {
  // セッション関連
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // 入力・送信
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // 画像添付
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // メモリ管理モーダル
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [memories, setMemories] = useState<ChatMemory[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);

  // 履歴パネルの表示切替（トグル）
  const [showHistory, setShowHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // セッション一覧取得
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) {
      console.error("セッション取得エラー:", e);
    }
  }, []);

  // メッセージ取得
  const fetchMessages = useCallback(async (sessionId: number) => {
    try {
      const res = await fetch(`/api/chat/messages?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error("メッセージ取得エラー:", e);
    }
  }, []);

  // 初回読み込み
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // セッション切替時にメッセージ読み込み
  useEffect(() => {
    if (activeSessionId) {
      fetchMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId, fetchMessages]);

  // メッセージ追加時に自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 画像選択ハンドラー
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // 画像ファイルのみ許可（最大5枚、各10MB以下）
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) continue;
      if (attachedImages.length + newFiles.length >= 5) break;

      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setAttachedImages((prev) => [...prev, ...newFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);

    // input をリセット（同じファイルを再選択可能にする）
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 画像削除
  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // メッセージ送信
  const handleSend = async () => {
    if ((!input.trim() && attachedImages.length === 0) || sending) return;

    const userMessage = input.trim() || "この画像を分析してください";
    const currentImages = [...attachedImages];
    const currentPreviews = [...imagePreviews];

    setInput("");
    setAttachedImages([]);
    setImagePreviews([]);
    setSending(true);

    // textareaの高さをリセット
    if (inputRef.current) {
      inputRef.current.style.height = "44px";
    }

    // 楽観的にユーザーメッセージを表示（画像付き）
    const displayContent = currentImages.length > 0
      ? `${userMessage}\n\n[画像${currentImages.length}枚添付]`
      : userMessage;

    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      sessionId: activeSessionId || 0,
      role: "user",
      content: displayContent,
      createdAt: new Date().toISOString(),
      imageUrls: currentPreviews,
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      let res: Response;

      if (currentImages.length > 0) {
        // 画像ありの場合はFormDataで送信
        const formData = new FormData();
        formData.append("message", userMessage);
        if (activeSessionId) {
          formData.append("sessionId", activeSessionId.toString());
        }
        for (const img of currentImages) {
          formData.append("images", img);
        }
        res = await fetch("/api/chat", {
          method: "POST",
          body: formData,
        });
      } else {
        // テキストのみの場合はJSON（従来通り）
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSessionId,
            message: userMessage,
          }),
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "送信に失敗しました");
      }

      const data = await res.json();

      // 新規セッションの場合、セッションIDを設定
      if (!activeSessionId) {
        setActiveSessionId(data.sessionId);
      }

      // AI応答を追加
      const aiMsg: ChatMessage = {
        id: data.messageId,
        sessionId: data.sessionId,
        role: "assistant",
        content: data.reply,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      // セッション一覧を更新
      fetchSessions();
    } catch (e) {
      console.error("送信エラー:", e);
      const errMsg: ChatMessage = {
        id: Date.now() + 1,
        sessionId: activeSessionId || 0,
        role: "assistant",
        content: `エラーが発生しました: ${e instanceof Error ? e.message : "不明なエラー"}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
      // プレビューURLを解放
      currentPreviews.forEach((url) => URL.revokeObjectURL(url));
      inputRef.current?.focus();
    }
  };

  // Enterキーは改行のみ（送信はボタンのみ）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 何もしない（Enterは通常通り改行になる）
    void e;
  };

  // 新規チャット
  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInput("");
    setShowHistory(false);
    inputRef.current?.focus();
  };

  // セッション選択
  const handleSelectSession = (sessionId: number) => {
    setActiveSessionId(sessionId);
    setShowHistory(false);
  };

  // セッション削除
  const handleDeleteSession = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("このチャットを削除しますか？")) return;

    try {
      const res = await fetch(`/api/chat?sessionId=${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
          setMessages([]);
        }
        fetchSessions();
      }
    } catch (e) {
      console.error("削除エラー:", e);
    }
  };

  // メモリ一覧取得
  const fetchMemories = async () => {
    setLoadingMemories(true);
    try {
      const res = await fetch("/api/chat/memories");
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch (e) {
      console.error("メモリ取得エラー:", e);
    } finally {
      setLoadingMemories(false);
    }
  };

  // メモリ削除
  const handleDeleteMemory = async (id: number) => {
    try {
      const res = await fetch(`/api/chat/memories?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (e) {
      console.error("メモリ削除エラー:", e);
    }
  };

  // メモリモーダル開く
  const openMemoryModal = () => {
    setShowMemoryModal(true);
    setShowHistory(false);
    fetchMemories();
  };

  // 日付フォーマット
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return "たった今";
      if (minutes < 60) return `${minutes}分前`;
      if (hours < 24) return `${hours}時間前`;
      if (days < 7) return `${days}日前`;
      return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  // マークダウン簡易レンダリング
  const renderMarkdown = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const code = part.slice(3, -3).replace(/^\w*\n/, "");
        return (
          <pre key={i} className="bg-navy-950 rounded-lg p-3 my-2 overflow-x-auto text-sm">
            <code>{code}</code>
          </pre>
        );
      }
      const lines = part.split("\n");
      return lines.map((line, j) => {
        if (line.startsWith("### ")) {
          return <h4 key={`${i}-${j}`} className="font-bold text-white mt-3 mb-1">{line.slice(4)}</h4>;
        }
        if (line.startsWith("## ")) {
          return <h3 key={`${i}-${j}`} className="font-bold text-white text-lg mt-3 mb-1">{line.slice(3)}</h3>;
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={`${i}-${j}`} className="flex gap-2 ml-2">
              <span className="text-accent-400 flex-shrink-0">-</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        const numMatch = line.match(/^(\d+)\.\s/);
        if (numMatch) {
          return (
            <div key={`${i}-${j}`} className="flex gap-2 ml-2">
              <span className="text-accent-400 flex-shrink-0">{numMatch[1]}.</span>
              <span>{renderInline(line.slice(numMatch[0].length))}</span>
            </div>
          );
        }
        if (line.trim() === "") {
          return <div key={`${i}-${j}`} className="h-2" />;
        }
        return <p key={`${i}-${j}`}>{renderInline(line)}</p>;
      });
    });
  };

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="bg-navy-800 px-1.5 py-0.5 rounded text-accent-300 text-sm">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 lg:left-60 flex flex-col overflow-hidden">
      {/* ヘッダー（固定） */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-navy-700 bg-navy-900">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-accent-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            <h1 className="text-white font-semibold">AIチャット</h1>
          </div>
          {activeSessionId && (
            <span className="text-xs text-gray-500 truncate max-w-[200px]">
              {sessions.find((s) => s.id === activeSessionId)?.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 新規チャットボタン */}
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 text-navy-900 text-sm font-medium rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="hidden sm:inline">新規</span>
          </button>
          {/* 履歴トグルボタン */}
          <button
            onClick={() => { setShowHistory(!showHistory); fetchSessions(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              showHistory
                ? "bg-accent-500/20 text-accent-400"
                : "text-gray-400 hover:text-white hover:bg-navy-800"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">履歴</span>
            {sessions.length > 0 && (
              <span className="bg-navy-700 text-gray-300 text-xs px-1.5 py-0.5 rounded-full">{sessions.length}</span>
            )}
          </button>
          {/* メモリ管理ボタン */}
          <button
            onClick={openMemoryModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-navy-800 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            <span className="hidden sm:inline">メモリ</span>
          </button>
        </div>
      </div>

      {/* 履歴ドロップダウンパネル */}
      {showHistory && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowHistory(false)} />
          <div className="absolute right-4 top-14 z-40 w-80 max-h-[60vh] bg-navy-900 border border-navy-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-navy-700">
              <span className="text-sm font-medium text-white">チャット履歴</span>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">
                  まだチャットがありません
                </p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      activeSessionId === session.id
                        ? "bg-accent-500/20 text-accent-400"
                        : "text-gray-300 hover:bg-navy-800"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 flex-shrink-0 text-gray-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{session.title}</p>
                      <p className="text-xs text-gray-500">{formatDate(session.updatedAt)}</p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                      title="削除"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* メッセージエリア（スクロール可能な唯一の部分） */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-accent-500/10 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-accent-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">nodeSEO AIアシスタント</h2>
            <p className="text-gray-400 text-sm max-w-md">
              登録中のサイト・キーワード・順位データをもとに、逆SEO対策のアドバイスや分析結果の深掘りができます。
            </p>
            <div className="mt-6 grid gap-2 w-full max-w-md">
              {[
                "現在の順位状況を教えて",
                "ネガティブ記事への具体的な対策を提案して",
                "サジェスト対策の優先順位を教えて",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="text-left px-4 py-3 rounded-lg border border-navy-700 text-sm text-gray-300 hover:bg-navy-800 hover:border-accent-500/30 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] lg:max-w-[70%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-accent-500 text-navy-900"
                    : "bg-navy-800 text-gray-200"
                }`}
              >
                {/* 画像プレビュー（ユーザーメッセージのみ） */}
                {msg.imageUrls && msg.imageUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {msg.imageUrls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`添付画像${i + 1}`}
                        className="max-w-[200px] max-h-[150px] rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}
                {msg.role === "assistant" ? (
                  <div className="text-sm leading-relaxed space-y-1">
                    {renderMarkdown(msg.content)}
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}

        {/* 送信中インジケーター */}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-navy-800 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-accent-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-accent-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-accent-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア（固定） */}
      <div className="flex-shrink-0 border-t border-navy-700 p-4 bg-navy-900">
        <div className="max-w-4xl mx-auto">
          {/* 画像プレビュー */}
          {imagePreviews.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {imagePreviews.map((url, i) => (
                <div key={i} className="relative group">
                  <img
                    src={url}
                    alt={`添付画像${i + 1}`}
                    className="w-16 h-16 rounded-lg object-cover border border-navy-600"
                  />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
              <span className="self-end text-xs text-gray-500 mb-1">
                {attachedImages.length}/5枚
              </span>
            </div>
          )}
          <div className="flex gap-2">
            {/* 画像添付ボタン */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || attachedImages.length >= 5}
              className="flex-shrink-0 px-3 py-2 text-gray-400 hover:text-accent-400 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
              title="画像を添付（最大5枚）"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Zm16.5-13.5h.008v.008h-.008V7.5Zm0 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachedImages.length > 0 ? "画像についてメッセージを入力..." : "メッセージを入力..."}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-navy-600 bg-navy-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-colors"
              style={{ minHeight: "44px", maxHeight: "120px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 120) + "px";
              }}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && attachedImages.length === 0) || sending}
              className="flex-shrink-0 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed text-navy-900 font-medium rounded-xl transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* メモリ管理モーダル */}
      {showMemoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-accent-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                <h3 className="text-white font-semibold">AIメモリ管理</h3>
              </div>
              <button
                onClick={() => setShowMemoryModal(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <p className="text-sm text-gray-400 mb-4">
                AIがチャットで学習した情報です。不要なメモリは削除できます。
              </p>
              {loadingMemories ? (
                <div className="text-center py-8 text-gray-500">読み込み中...</div>
              ) : memories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  まだメモリがありません。チャットを通じてAIが自動的に学習します。
                </div>
              ) : (
                <div className="space-y-3">
                  {memories.map((memory) => (
                    <div
                      key={memory.id}
                      className="flex items-start gap-3 bg-navy-800 rounded-lg p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200">{memory.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {memory.source && (
                            <span className="text-xs text-gray-500">{memory.source}</span>
                          )}
                          <span className="text-xs text-gray-600">
                            {formatDate(memory.createdAt)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteMemory(memory.id)}
                        className="flex-shrink-0 p-1 text-gray-500 hover:text-red-400 transition-colors"
                        title="削除"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

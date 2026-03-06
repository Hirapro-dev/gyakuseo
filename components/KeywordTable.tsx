"use client";

import { useState } from "react";
import type { Keyword } from "@/lib/schema";

interface KeywordTableProps {
  keywords: Keyword[];
  onUpdate: (id: number, data: Partial<Keyword>) => void;
  onDelete: (id: number) => void;
}

export function KeywordTable({
  keywords,
  onUpdate,
  onDelete,
}: KeywordTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editKeyword, setEditKeyword] = useState("");
  const [editMemo, setEditMemo] = useState("");

  // 編集モードの開始
  const startEdit = (kw: Keyword) => {
    setEditingId(kw.id);
    setEditKeyword(kw.keyword);
    setEditMemo(kw.memo || "");
  };

  // 編集の保存
  const saveEdit = (id: number) => {
    onUpdate(id, { keyword: editKeyword, memo: editMemo });
    setEditingId(null);
  };

  // 編集のキャンセル
  const cancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-navy-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              キーワード
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              メモ
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              監視状態
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-navy-950 divide-y divide-gray-200 dark:divide-gray-700">
          {keywords.map((kw) => (
            <tr key={kw.id} className="hover:bg-gray-50 dark:hover:bg-navy-900/50">
              <td className="px-6 py-4 whitespace-nowrap">
                {editingId === kw.id ? (
                  <input
                    type="text"
                    value={editKeyword}
                    onChange={(e) => setEditKeyword(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-navy-900 text-gray-900 dark:text-white"
                  />
                ) : (
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {kw.keyword}
                  </span>
                )}
              </td>
              <td className="px-6 py-4">
                {editingId === kw.id ? (
                  <input
                    type="text"
                    value={editMemo}
                    onChange={(e) => setEditMemo(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-navy-900 text-gray-900 dark:text-white"
                  />
                ) : (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {kw.memo || "-"}
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-center">
                <button
                  onClick={() =>
                    onUpdate(kw.id, { isActive: !kw.isActive })
                  }
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    kw.isActive
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  {kw.isActive ? "ON" : "OFF"}
                </button>
              </td>
              <td className="px-6 py-4 text-center whitespace-nowrap">
                {editingId === kw.id ? (
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => saveEdit(kw.id)}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                    >
                      保存
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-gray-500 hover:underline text-sm"
                    >
                      キャンセル
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => startEdit(kw)}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => onDelete(kw.id)}
                      className="text-red-600 dark:text-red-400 hover:underline text-sm"
                    >
                      削除
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {keywords.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
              >
                キーワードが登録されていません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

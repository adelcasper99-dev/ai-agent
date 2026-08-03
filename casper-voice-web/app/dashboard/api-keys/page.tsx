"use client";

import { useState, useEffect, useCallback } from "react";

interface ApiKey {
  id: string;
  provider: string;
  keyString: string;
  isActive: boolean;
  isExhausted: boolean;
  exhaustedAt: string | null;
  addedAt: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<"gemini" | "groq">("gemini");
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/api-keys");
    const data = await res.json();
    if (data.success) {
      setKeys(data.keys);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchKeys();
    // Auto-refresh every 30s to reflect real-time exhaustion status
    const interval = setInterval(fetchKeys, 30000);
    return () => clearInterval(interval);
  }, [fetchKeys]);

  const allExhausted =
    keys.length > 0 && keys.every((k) => k.isExhausted || !k.isActive);
  const exhaustedCount = keys.filter((k) => k.isExhausted).length;
  const availableCount = keys.filter((k) => !k.isExhausted && k.isActive).length;

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey) return;
    const res = await fetch("/api/admin/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: selectedProvider, keyString: newKey }),
    });
    const data = await res.json();
    if (data.success) {
      setNewKey("");
      fetchKeys();
    } else {
      alert("Error: " + data.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المفتاح؟")) return;
    const res = await fetch(`/api/admin/api-keys?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchKeys();
    }
  };

  const handleResetAll = async () => {
    if (!confirm("هل تريد إعادة تفعيل جميع المفاتيح المستنفدة؟")) return;
    setResetting(true);
    const res = await fetch("/api/admin/api-keys", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "all" }),
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ تم إعادة تفعيل ${data.resetCount} مفتاح بنجاح`);
      fetchKeys();
    } else {
      alert("❌ فشل إعادة التفعيل: " + data.error);
    }
    setResetting(false);
  };

  const handleTestKey = async (id: string, keyString: string) => {
    setTestingId(id);
    try {
      const res = await fetch("/api/admin/api-keys/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyString }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ " + data.message);
      } else {
        alert("❌ " + data.message);
      }
    } catch (e) {
      alert("❌ حدث خطأ أثناء الاتصال");
    }
    setTestingId(null);
    fetchKeys();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">محفظة مفاتيح الذكاء الاصطناعي (API Keys Pool)</h1>
          <p className="text-sm text-gray-500 mt-1">إدارة مفاتيح Gemini و Groq والتنقل التلقائي عند استنفاذ الكوتا</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {availableCount} متاح / {exhaustedCount} مستنفد
          </span>
          <button
            onClick={fetchKeys}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"
          >
            🔄 تحديث
          </button>
        </div>
      </div>

      {/* 🚨 All-Keys-Exhausted Banner */}
      {allExhausted && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">🚨</span>
          <div className="flex-1">
            <p className="font-bold text-red-800 text-base">
              تحذير: جميع المفاتيح المسجلة مستنفدة!
            </p>
            <p className="text-red-700 text-sm mt-1">
              النظام يتحول تلقائياً لوضع القوائم الطارئ حتى تُضاف مفاتيح جديدة أو تُعاد تفعيل المفاتيح الحالية.
            </p>
            <button
              onClick={handleResetAll}
              disabled={resetting}
              className="mt-2 px-4 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {resetting ? "جاري الإعادة..." : "⚡ إعادة تفعيل الكل الآن"}
            </button>
          </div>
        </div>
      )}

      {/* ⚠️ Partial exhaustion warning */}
      {!allExhausted && exhaustedCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <p className="text-amber-800 text-sm">
              <strong>{exhaustedCount} مفتاح مستنفد</strong> — النظام يعمل على المفاتيح المتبقية ({availableCount} متاح)
            </p>
          </div>
          <button
            onClick={handleResetAll}
            disabled={resetting}
            className="px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {resetting ? "..." : "إعادة تفعيل المستنفدة"}
          </button>
        </div>
      )}

      {/* Add Key Form with Provider Selector */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <form onSubmit={handleAddKey} className="flex gap-4 items-end">
          <div className="w-48 space-y-2">
            <label className="block text-sm font-medium text-gray-700">المزود (Provider)</label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as "gemini" | "groq")}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
            >
              <option value="gemini">💎 Gemini (Google)</option>
              <option value="groq">⚡ Groq (Llama 3.3)</option>
            </select>
          </div>
          <div className="flex-1 space-y-2">
            <label className="block text-sm font-medium text-gray-700">مفتاح API الجديد</label>
            <input
              type="password"
              placeholder={selectedProvider === "gemini" ? "AIzaSy..." : "gsk_..."}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-left font-mono"
              dir="ltr"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 h-[42px] font-medium">
            إضافة المفتاح
          </button>
        </form>
      </div>

      {/* Keys Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">جاري التحميل...</div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            لا يوجد مفاتيح مسجلة في قاعدة البيانات. النظام يقرأ المفاتيح الموجودة في ملف .env تلقائياً.
          </div>
        ) : (
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">المزود</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">المفتاح</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">الحالة</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">وقت الإضافة</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((k) => (
                <tr
                  key={k.id}
                  className={`hover:bg-gray-50 ${k.isExhausted ? "bg-red-50/30" : ""}`}
                >
                  <td className="px-6 py-4 text-sm">
                    {k.provider?.toLowerCase() === "groq" ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-md text-xs">
                        ⚡ Groq
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md text-xs">
                        💎 Gemini
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-500 text-left" dir="ltr">
                    {k.keyString.substring(0, 8)}...{k.keyString.slice(-4)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {k.isExhausted ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          🔴 مستنفد (429)
                        </span>
                        {k.exhaustedAt && (() => {
                          const exhaustedDate = new Date(k.exhaustedAt);
                          const resetDate = new Date(exhaustedDate.getTime() + 24 * 60 * 60 * 1000);
                          const now = new Date();
                          const msLeft = resetDate.getTime() - now.getTime();
                          const hoursLeft = Math.floor(msLeft / (1000 * 60 * 60));
                          const minutesLeft = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
                          return (
                            <div className="text-[11px] space-y-0.5">
                              <p className="text-red-500">
                                خلص الساعة: {exhaustedDate.toLocaleTimeString("ar-EG")} — {exhaustedDate.toLocaleDateString("ar-EG")}
                              </p>
                              <p className="text-orange-600 font-medium">
                                🕐 ريفريش تلقائي: {resetDate.toLocaleTimeString("ar-EG")} ({hoursLeft > 0 ? `${hoursLeft}س ${minutesLeft}د` : `${minutesLeft} دقيقة`} متبقية)
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        🟢 متاح وشغال
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(k.addedAt).toLocaleDateString("ar-EG")}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleTestKey(k.id, k.keyString)}
                        disabled={testingId === k.id}
                        className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                      >
                        {testingId === k.id ? "⏳" : "فحص"}
                      </button>
                      <button
                        onClick={() => handleDelete(k.id)}
                        className="text-red-500 hover:text-red-700 font-medium"
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-100">
        <p>
          <strong>كيف يعمل مجمّع المفاتيح الذكي:</strong> يبدأ النظام بمفاتيح 💎 <strong>Gemini</strong> المتاحة. وفي حال مواجهة 429 (انتهاء الكوتا اليومية)، ينتقل لمفتاح Gemini التالي. وعند انتهاء جميع مفاتيح Gemini، يتحول تلقائياً لمفاتيح ⚡ <strong>Groq (Llama 3.3)</strong> الدائرية. ولا يرسل وضع القوائم الطارئ إلا إذا نفذت جميع المفاتيح معاً.
        </p>
      </div>
    </div>
  );
}

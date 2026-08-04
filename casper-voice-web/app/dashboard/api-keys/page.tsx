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

  const handleTestKey = async (id: string, keyString: string, provider: string) => {
    setTestingId(id);
    try {
      const res = await fetch("/api/admin/api-keys/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyString, provider }),
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

  // Shared inline styles
  const actionBtn = (variant: "default" | "success" | "brand" | "danger" | "warning") => ({
    default: {
      background: "rgba(255,255,255,0.06)",
      color: "var(--color-text-muted)",
      border: "1px solid var(--color-border-glass)",
    },
    success: {
      background: "rgba(21,132,110,0.12)",
      color: "#1fc9a4",
      border: "1px solid rgba(21,132,110,0.24)",
    },
    brand: {
      background: "rgba(128,82,255,0.12)",
      color: "var(--color-brand)",
      border: "1px solid rgba(128,82,255,0.24)",
    },
    danger: {
      background: "rgba(229,72,77,0.12)",
      color: "var(--color-danger)",
      border: "1px solid rgba(229,72,77,0.24)",
    },
    warning: {
      background: "rgba(255,178,36,0.12)",
      color: "#ffb224",
      border: "1px solid rgba(255,178,36,0.24)",
    }
  }[variant]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-10" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>محفظة مفاتيح الذكاء الاصطناعي (API Keys Pool)</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>إدارة مفاتيح Gemini و Groq والتنقل التلقائي عند استنفاذ الكوتا</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold" style={{ color: "var(--color-text-secondary)" }}>
            {availableCount} متاح / {exhaustedCount} مستنفد
          </span>
          <button
            onClick={fetchKeys}
            className="px-3 py-1.5 text-sm rounded-lg font-bold transition-all"
            style={actionBtn("default")}
          >
            🔄 تحديث
          </button>
        </div>
      </div>

      {/* 🚨 All-Keys-Exhausted Banner */}
      {allExhausted && (
        <div className="p-4 rounded-xl flex items-start gap-3 border" style={{ background: "rgba(229,72,77,0.08)", borderColor: "rgba(229,72,77,0.3)" }}>
          <span className="text-2xl">🚨</span>
          <div className="flex-1">
            <p className="font-bold text-base" style={{ color: "var(--color-danger)" }}>
              تحذير: جميع المفاتيح المسجلة مستنفدة!
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--color-danger)", opacity: 0.8 }}>
              النظام يتحول تلقائياً لوضع القوائم الطارئ حتى تُضاف مفاتيح جديدة أو تُعاد تفعيل المفاتيح الحالية.
            </p>
            <button
              onClick={handleResetAll}
              disabled={resetting}
              className="mt-3 px-4 py-2 text-sm rounded-lg font-bold transition-all disabled:opacity-50"
              style={actionBtn("danger")}
            >
              {resetting ? "جاري الإعادة..." : "⚡ إعادة تفعيل الكل الآن"}
            </button>
          </div>
        </div>
      )}

      {/* ⚠️ Partial exhaustion warning */}
      {!allExhausted && exhaustedCount > 0 && (
        <div className="p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border" style={{ background: "rgba(255,178,36,0.08)", borderColor: "rgba(255,178,36,0.3)" }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <p className="text-sm font-bold" style={{ color: "#ffb224" }}>
              <strong>{exhaustedCount} مفتاح مستنفد</strong> — النظام يعمل على المفاتيح المتبقية ({availableCount} متاح)
            </p>
          </div>
          <button
            onClick={handleResetAll}
            disabled={resetting}
            className="px-4 py-2 text-sm rounded-lg font-bold transition-all disabled:opacity-50"
            style={actionBtn("warning")}
          >
            {resetting ? "..." : "إعادة تفعيل المستنفدة"}
          </button>
        </div>
      )}

      {/* Add Key Form with Provider Selector */}
      <div className="bento-card p-5 sm:p-6">
        <form onSubmit={handleAddKey} className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="w-full sm:w-48 space-y-2">
            <label className="block text-sm font-bold" style={{ color: "var(--color-text-secondary)" }}>المزود (Provider)</label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as "gemini" | "groq")}
              className="glass-input font-bold"
            >
              <option value="gemini">💎 Gemini (Google)</option>
              <option value="groq">⚡ Groq (Llama 3.3)</option>
            </select>
          </div>
          <div className="flex-1 space-y-2 w-full">
            <label className="block text-sm font-bold" style={{ color: "var(--color-text-secondary)" }}>مفتاح API الجديد</label>
            <input
              type="password"
              placeholder={selectedProvider === "gemini" ? "AIzaSy..." : "gsk_..."}
              className="glass-input font-mono dir-ltr text-left"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap"
            style={{
              background: "var(--color-brand)",
              color: "#fff",
              boxShadow: "var(--shadow-glow)",
              height: "44px"
            }}
          >
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
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(229,72,77,0.1)", color: "var(--color-danger)" }}>
                        🔴 مستنفد (429)
                      </span>
                    ) : !k.isActive ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(255,255,255,0.1)", color: "var(--color-text-muted)" }}>
                        ⚫ غير مفعل
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(21,132,110,0.1)", color: "#1fc9a4" }}>
                        🟢 متاح وشغال
                      </span>
                    )}
                    {k.exhaustedAt && (
                      <div className="text-[10px] mt-1" style={{ color: "var(--color-text-muted)" }}>
                        مستنفد منذ: {new Date(k.exhaustedAt).toLocaleTimeString("ar-EG")}
                      </div>
                    )}
                  </td>
                    <td className="px-6 py-4" style={{ color: "var(--color-text-muted)" }}>
                      {new Date(k.addedAt).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      <button
                        onClick={() => handleTestKey(k.id, k.keyString, k.provider)}
                        disabled={testingId === k.id}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                        style={actionBtn("brand")}
                      >
                        {testingId === k.id ? "..." : "فحص"}
                      </button>
                      <button
                        onClick={() => handleDelete(k.id)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                        style={actionBtn("danger")}
                      >
                        حذف
                      </button>
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

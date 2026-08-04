"use client";

import { useState, useEffect, useCallback } from "react";
import { Key, AlertTriangle, AlertCircle, RefreshCw, Plus, Trash2, CheckCircle2 } from "lucide-react";

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
    const interval = setInterval(fetchKeys, 30000);
    return () => clearInterval(interval);
  }, [fetchKeys]);

  const allExhausted = keys.length > 0 && keys.every((k) => k.isExhausted || !k.isActive);
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

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--foreground)" }}>
            محفظة مفاتيح الذكاء الاصطناعي
          </h1>
          <div className="flex items-center gap-2 mt-2 text-sm">
            <span className="px-2 py-0.5 rounded font-bold" style={{ background: "var(--border)", color: "var(--muted-foreground)" }}>API Keys Pool</span>
            <span style={{ color: "var(--muted-foreground)" }}>•</span>
            <span className="font-semibold" style={{ color: "var(--foreground)" }}>إدارة المفاتيح والتنقل التلقائي عند الاستنفاذ</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border shadow-sm bg-white" style={{ borderColor: "var(--border)" }}>
            <span className="text-sm font-bold text-emerald-600">{availableCount} متاح</span>
            <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />
            <span className="text-sm font-bold text-rose-600">{exhaustedCount} مستنفد</span>
          </div>
          <button
            onClick={fetchKeys}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all shadow-sm bg-white hover:bg-slate-50 border"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <RefreshCw size={16} /> تحديث
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {allExhausted && (
        <div className="flex items-start gap-4 p-5 rounded-xl border" style={{ background: "#fef2f2", borderColor: "#fca5a5" }}>
          <AlertCircle className="w-8 h-8 text-rose-600 shrink-0" />
          <div className="flex-1">
            <h3 className="font-bold text-lg text-rose-700">تحذير: جميع المفاتيح المسجلة مستنفدة!</h3>
            <p className="text-sm mt-1 text-rose-600 opacity-90">
              النظام يتحول تلقائياً لوضع القوائم الطارئ حتى تُضاف مفاتيح جديدة أو تُعاد تفعيل المفاتيح الحالية.
            </p>
            <button
              onClick={handleResetAll}
              disabled={resetting}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-all disabled:opacity-50 text-white shadow-sm"
              style={{ background: "var(--danger)" }}
            >
              <RefreshCw size={16} className={resetting ? "animate-spin" : ""} />
              {resetting ? "جاري الإعادة..." : "إعادة تفعيل الكل الآن"}
            </button>
          </div>
        </div>
      )}

      {!allExhausted && exhaustedCount > 0 && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl border shadow-sm" style={{ background: "#fffbeb", borderColor: "#fcd34d" }}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
            <p className="text-sm font-bold text-amber-700">
              {exhaustedCount} مفتاح مستنفد — النظام يعمل على المفاتيح المتبقية ({availableCount} متاح)
            </p>
          </div>
          <button
            onClick={handleResetAll}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-50 bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300"
          >
            <RefreshCw size={16} className={resetting ? "animate-spin" : ""} />
            {resetting ? "..." : "إعادة تفعيل المستنفدة"}
          </button>
        </div>
      )}

      {/* ── Add Key Form ── */}
      <div className="float-panel p-6 border shadow-sm bg-white" style={{ borderColor: "var(--border)" }}>
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
          <Plus size={18} className="text-cyan-500" /> إضافة مفتاح جديد
        </h3>
        <form onSubmit={handleAddKey} className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="w-full sm:w-56 space-y-2">
            <label className="block text-sm font-bold" style={{ color: "var(--muted-foreground)" }}>المزود</label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as "gemini" | "groq")}
              className="w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-cyan-500 outline-none font-bold"
              style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <option value="gemini">💎 Gemini (Google)</option>
              <option value="groq">⚡ Groq (Llama 3.3)</option>
            </select>
          </div>
          <div className="flex-1 space-y-2 w-full">
            <label className="block text-sm font-bold" style={{ color: "var(--muted-foreground)" }}>مفتاح API</label>
            <input
              type="password"
              placeholder={selectedProvider === "gemini" ? "AIzaSy..." : "gsk_..."}
              className="w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-cyan-500 outline-none font-mono dir-ltr text-left"
              style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg font-bold transition-all whitespace-nowrap text-white shadow-md flex items-center gap-2 justify-center"
            style={{ background: "var(--primary)" }}
          >
            <Plus size={18} /> حفظ المفتاح
          </button>
        </form>
      </div>

      {/* ── Keys Table ── */}
      <div className="float-panel border shadow-sm bg-white overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: "var(--foreground)" }}>
            <Key size={18} className="text-cyan-500" /> المفاتيح المسجلة
          </h3>
        </div>
        
        {loading ? (
          <div className="p-12 flex justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-semibold">
            لا يوجد مفاتيح مسجلة. النظام يقرأ المفاتيح من ملف .env تلقائياً إذا وجدت.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="zebra-table">
              <thead>
                <tr>
                  <th>المزود</th>
                  <th>المفتاح</th>
                  <th>الحالة</th>
                  <th>تاريخ الإضافة</th>
                  <th className="text-center">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td>
                      {k.provider?.toLowerCase() === "groq" ? (
                        <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-md text-xs border border-purple-200">
                          ⚡ Groq
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-md text-xs border border-blue-200">
                          💎 Gemini
                        </span>
                      )}
                    </td>
                    <td className="font-mono text-sm text-slate-600 text-left dir-ltr">
                      {k.keyString.substring(0, 8)}...{k.keyString.slice(-4)}
                    </td>
                    <td>
                      {k.isExhausted ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200">
                            🔴 مستنفد (429)
                          </span>
                          {k.exhaustedAt && (
                            <div className="text-[10px] mt-1 text-slate-400">
                              منذ: {new Date(k.exhaustedAt).toLocaleTimeString("ar-EG")}
                            </div>
                          )}
                        </div>
                      ) : !k.isActive ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200">
                          ⚫ غير مفعل
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                          🟢 متاح وشغال
                        </span>
                      )}
                    </td>
                    <td className="text-sm text-slate-500 font-medium">
                      {new Date(k.addedAt).toLocaleDateString("ar-EG")}
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleTestKey(k.id, k.keyString, k.provider)}
                          disabled={testingId === k.id}
                          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-md transition-all bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                          {testingId === k.id ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} className="text-cyan-600" />}
                          فحص
                        </button>
                        <button
                          onClick={() => handleDelete(k.id)}
                          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-md transition-all bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 size={14} /> حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Info Box ── */}
      <div className="bg-cyan-50/50 p-5 rounded-xl border border-cyan-100 text-sm text-cyan-800 shadow-sm">
        <p className="flex items-start gap-3">
          <span className="text-xl">ℹ️</span>
          <span className="leading-relaxed font-medium">
            <strong className="text-cyan-900">كيف يعمل مجمّع المفاتيح الذكي:</strong> يبدأ النظام بمفاتيح 💎 <strong>Gemini</strong> المتاحة. وفي حال مواجهة خطأ 429 (انتهاء الكوتا اليومية)، ينتقل النظام تلقائياً لمفتاح Gemini التالي. وعند انتهاء جميع مفاتيح Gemini، يتحول تدريجياً لمفاتيح ⚡ <strong>Groq (Llama 3.3)</strong> الدائرية لضمان استمرارية الخدمة. لا يتم اللجوء لوضع القوائم الطارئ إلا إذا استُنفِذت جميع المفاتيح معاً.
          </span>
        </p>
      </div>
    </div>
  );
}

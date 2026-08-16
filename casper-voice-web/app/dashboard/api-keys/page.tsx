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
    <div className="space-y-8 max-w-7xl mx-auto" dir="rtl">
      {/* ── Page Header ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-zinc-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span className="p-2 rounded-xl bg-sparkles-500/10 text-cyan-400 border border-cyan-500/20">✨</span>
            محفظة مفاتيح الذكاء الاصطناعي (Gemini & Groq Keys)
          </h1>
          <div className="flex items-center gap-2 mt-2 text-sm">
            <span className="px-3 py-1 rounded-lg font-bold bg-white/5 border border-white/10 text-zinc-300">API Keys Pool</span>
            <span className="text-zinc-500">•</span>
            <span className="font-medium text-zinc-400">إدارة المفاتيح والتنقل التلقائي عند الاستنفاذ</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-white/10 bg-zinc-950/50 shadow-inner">
            <span className="text-sm font-bold text-emerald-400">{availableCount} متاح</span>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <span className="text-sm font-bold text-rose-400">{exhaustedCount} مستنفد</span>
          </div>
          <button
            onClick={fetchKeys}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold transition-all bg-white/5 hover:bg-white/10 text-white border border-white/10"
          >
            <RefreshCw size={16} /> تحديث
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {allExhausted && (
        <div className="flex items-start gap-4 p-6 rounded-3xl border bg-rose-500/10 border-rose-500/30 text-rose-400">
          <AlertCircle className="w-8 h-8 text-rose-400 shrink-0" />
          <div className="flex-1">
            <h3 className="font-bold text-lg text-rose-300">تحذير: جميع المفاتيح المسجلة مستنفدة!</h3>
            <p className="text-sm mt-1 text-rose-400/90">
              النظام يتحول تلقائياً لوضع القوائم الطارئ حتى تُضاف مفاتيح جديدة أو تُعاد تفعيل المفاتيح الحالية.
            </p>
            <button
              onClick={handleResetAll}
              disabled={resetting}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold transition-all disabled:opacity-50 text-white bg-rose-600 hover:bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
            >
              <RefreshCw size={16} className={resetting ? "animate-spin" : ""} />
              {resetting ? "جاري الإعادة..." : "إعادة تفعيل الكل الآن"}
            </button>
          </div>
        </div>
      )}

      {!allExhausted && exhaustedCount > 0 && (
        <div className="flex items-center justify-between gap-4 p-5 rounded-3xl border bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-2xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
            <p className="text-sm font-bold text-amber-300">
              {exhaustedCount} مفتاح مستنفد — النظام يعمل على المفاتيح المتبقية ({availableCount} متاح)
            </p>
          </div>
          <button
            onClick={handleResetAll}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold transition-all disabled:opacity-50 bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-black border border-amber-500/30"
          >
            <RefreshCw size={16} className={resetting ? "animate-spin" : ""} />
            {resetting ? "..." : "إعادة تفعيل المستنفدة"}
          </button>
        </div>
      )}

      {/* ── Add Key Form ── */}
      <div className="bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-2xl">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-white">
          <Plus size={18} className="text-cyan-400" /> إضافة مفتاح جديد
        </h3>
        <form onSubmit={handleAddKey} className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="w-full sm:w-56 space-y-2">
            <label className="block text-sm font-bold text-zinc-300">المزود</label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as "gemini" | "groq")}
              className="w-full h-12 px-4 bg-zinc-900/50 border border-white/10 text-white font-bold text-sm rounded-2xl outline-none cursor-pointer"
            >
              <option value="gemini" className="bg-zinc-900 text-white">💎 Gemini (Google)</option>
              <option value="groq" className="bg-zinc-900 text-white">⚡ Groq (Llama 3.3)</option>
            </select>
          </div>
          <div className="flex-1 space-y-2 w-full">
            <label className="block text-sm font-bold text-zinc-300">مفتاح API</label>
            <input
              type="password"
              placeholder={selectedProvider === "gemini" ? "AIzaSy..." : "gsk_..."}
              className="w-full h-12 px-4 bg-zinc-900/50 border border-white/10 text-white placeholder:text-zinc-500 font-mono text-sm rounded-2xl outline-none focus:border-white transition-all dir-ltr text-left"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="w-full sm:w-auto h-12 px-6 rounded-2xl font-bold transition-all whitespace-nowrap text-black bg-cyan-500 hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center gap-2 justify-center"
          >
            <Plus size={18} /> حفظ المفتاح
          </button>
        </form>
      </div>

      {/* ── Keys Table ── */}
      <div className="glass-card-lg border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2 text-white">
            <Key size={18} className="text-cyan-400" /> المفاتيح المسجلة
          </h3>
        </div>
        
        {loading ? (
          <div className="p-12 flex justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-semibold">
            لا يوجد مفاتيح مسجلة. النظام يقرأ المفاتيح من ملف .env تلقائياً إذا وجدت.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4">المزود</th>
                  <th className="px-6 py-4">المفتاح</th>
                  <th className="px-6 py-4">الحالة</th>
                  <th className="px-6 py-4">تاريخ الإضافة</th>
                  <th className="px-6 py-4 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      {k.provider?.toLowerCase() === "groq" ? (
                        <span className="inline-flex items-center gap-1 font-bold text-purple-300 bg-purple-950/60 px-3 py-1 rounded-xl text-xs border border-purple-800/60 shadow-sm">
                          ⚡ Groq
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-sky-300 bg-sky-950/60 px-3 py-1 rounded-xl text-xs border border-sky-800/60 shadow-sm">
                          💎 Gemini
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-slate-300 text-left dir-ltr">
                      {k.keyString.substring(0, 8)}...{k.keyString.slice(-4)}
                    </td>
                    <td className="px-6 py-4">
                      {k.isExhausted ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/60 border border-rose-800/60">
                            🔴 مستنفد (429)
                          </span>
                          {k.exhaustedAt && (
                            <div className="text-[10px] mt-1 text-slate-500">
                              منذ: {new Date(k.exhaustedAt).toLocaleTimeString("ar-EG")}
                            </div>
                          )}
                        </div>
                      ) : !k.isActive ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-slate-400 bg-slate-800/80 border border-slate-700">
                          ⚫ غير مفعل
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-800/60">
                          🟢 متاح وشغال
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400 font-medium">
                      {new Date(k.addedAt).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleTestKey(k.id, k.keyString, k.provider)}
                          disabled={testingId === k.id}
                          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl transition-all bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                        >
                          {testingId === k.id ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} className="text-cyan-400" />}
                          فحص
                        </button>
                        <button
                          onClick={() => handleDelete(k.id)}
                          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl transition-all bg-rose-950/40 border border-rose-800/50 text-rose-300 hover:bg-rose-900/60"
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
      <div className="glass-card-lg p-5 rounded-3xl border border-cyan-500/30 text-sm text-cyan-200 shadow-xl">
        <p className="flex items-start gap-3">
          <span className="text-xl">ℹ️</span>
          <span className="leading-relaxed font-medium">
            <strong className="text-cyan-100">كيف يعمل مجمّع المفاتيح الذكي:</strong> يبدأ النظام بمفاتيح 💎 <strong>Gemini</strong> المتاحة. وفي حال مواجهة خطأ 429 (انتهاء الكوتا اليومية)، ينتقل النظام تلقائياً لمفتاح Gemini التالي. وعند انتهاء جميع مفاتيح Gemini، يتحول تدريجياً لمفاتيح ⚡ <strong>Groq (Llama 3.3)</strong> الدائرية لضمان استمرارية الخدمة. لا يتم اللجوء لوضع القوائم الطارئ إلا إذا استُنفِذت جميع المفاتيح معاً.
          </span>
        </p>
      </div>
    </div>
  );
}

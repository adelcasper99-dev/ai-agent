// app/dashboard/settings/page.tsx
"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [adminPin, setAdminPin] = useState<string | null>(null);
  const [adminPinExpiry, setAdminPinExpiry] = useState<string | null>(null);
  const [generatingPin, setGeneratingPin] = useState(false);
  const [justLinked, setJustLinked] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setValues(d?.settings || {}))
      .catch(() => setValues({}))
      .finally(() => setLoading(false));
  }, []);

  // Poll settings every 3 seconds while adminPin is active
  useEffect(() => {
    if (!adminPin) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        const newSettings = data?.settings || {};
        if (newSettings.ADMIN_TELEGRAM_CHAT_ID && newSettings.ADMIN_TELEGRAM_CHAT_ID !== values.ADMIN_TELEGRAM_CHAT_ID) {
          setValues(newSettings);
          setAdminPin(null);
          setJustLinked(true);
          setTimeout(() => setJustLinked(false), 8000);
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [adminPin, values.ADMIN_TELEGRAM_CHAT_ID]);

  const generateAdminPin = async () => {
    setGeneratingPin(true);
    try {
      const res = await fetch("/api/dashboard/settings/admin-link/generate", {
        method: "POST",
      });
      const data = await res.json();
      if (data.code) {
        setAdminPin(data.code);
        setAdminPinExpiry(data.expiresAt);
      }
    } catch (err) {
      console.error("Failed to generate Admin PIN", err);
    } finally {
      setGeneratingPin(false);
    }
  };

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <div className="bento-card p-6 space-y-4">
          <div className="shimmer h-4 w-48 rounded-full" style={{ background: "#e2e8f0" }} />
          {[1,2,3].map(i => <div key={i} className="shimmer h-10 w-full rounded-xl" style={{ background: "#f1f5f9" }} />)}
        </div>
      </div>
    );
  }

  const safeValues = values || {};

  const actionBtn = (variant: "default" | "success" | "brand") => ({
    default: {
      background: "#fff",
      color: "var(--color-text-secondary)",
      border: "1px solid var(--color-border-subtle)",
    },
    success: {
      background: "#ecfdf5",
      color: "#059669",
      border: "1px solid #a7f3d0",
    },
    brand: {
      background: "#eff6ff",
      color: "var(--color-brand)",
      border: "1px solid #bfdbfe",
    },
  }[variant]);

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <h2 className="text-xl font-extrabold text-gray-800 dark:text-gray-100 flex items-center gap-2">
        ⚙️ إعدادات الأدمن والتليجرام
      </h2>

      {/* ── Telegram Admin Linking Card ── */}
      <div className="bento-card p-5 space-y-3 bg-pastel-blue border-0 shadow-sm">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--color-text-primary)" }}>
            📲 ربط وتحديث حساب الأدمن المباشر للتليجرام (Telegram Admin OTP Link)
          </label>
          <button
            type="button"
            onClick={generateAdminPin}
            disabled={generatingPin}
            className="px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm transition-all"
            style={actionBtn("brand")}
          >
            {generatingPin ? "جاري التوليد..." : "⚡ توليد كود ربط جديد (PIN)"}
          </button>
        </div>

        {justLinked && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-bounce">
            <span>🎉</span>
            <span>تم ربط حساب التليجرام الخاص بك كأدمن مباشر بنجاح! Chat ID: <strong>{safeValues["ADMIN_TELEGRAM_CHAT_ID"]}</strong></span>
          </div>
        )}

        {/* Live Status Badge */}
        <div className="p-3.5 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-blue-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${safeValues["ADMIN_TELEGRAM_CHAT_ID"] ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
              {safeValues["ADMIN_TELEGRAM_CHAT_ID"] ? "الحساب مرتبط ومفعل لاستقبال الطلبات والتنبيهات" : "لم يتم ربط حساب أدمن تليجرام بعد"}
            </span>
          </div>
          {safeValues["ADMIN_TELEGRAM_CHAT_ID"] && (
            <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-700">
              Chat ID: {safeValues["ADMIN_TELEGRAM_CHAT_ID"]}
            </span>
          )}
        </div>

        {adminPin ? (
          <div className="p-4 rounded-xl bg-white border border-blue-200 text-center space-y-2">
            <p className="text-xs text-gray-500 font-medium">افتح التليجرام وارسل هذا الكود للبوت المشترك قبل انتهاء الصلاحية (5 دقائق):</p>
            <div className="text-3xl font-extrabold font-mono tracking-widest text-blue-600 select-all">
              {adminPin}
            </div>
            <p className="text-xs text-blue-500">ينتهي الكود في: {new Date(adminPinExpiry || "").toLocaleTimeString("ar-EG")}</p>
            <p className="text-xs text-emerald-600 font-bold animate-pulse">⚡ في انتظار إرسالك للكود من الهاتف... (سيتم الربط والتحديث تلقائياً بمجرد إرساله)</p>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            انقر على "توليد كود ربط جديد" لإنشاء كود من 4 أرقام مدته 5 دقائق. بمجرد إرسال الكود للبوت في التليجرام يتم ربط حسابك كأدمن مباشر فورياً.
          </p>
        )}
      </div>

      {/* ── Telegram Admin & Bot Config ── */}
      <div className="bento-card p-5 space-y-4">
        <h3 className="font-bold text-base text-gray-800 dark:text-gray-100 flex items-center gap-2">
          🤖 إعدادات التليجرام وبوت المنصة
        </h3>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
            Admin Telegram Chat ID 📲 (معرف التليجرام المسجل حالياً لاستقبال التنبيهات)
          </label>
          <input
            type="text"
            value={safeValues["ADMIN_TELEGRAM_CHAT_ID"] || ""}
            onChange={(e) => setValues({ ...safeValues, ADMIN_TELEGRAM_CHAT_ID: e.target.value })}
            className="glass-input font-mono text-sm"
            placeholder="يتم تحديثه تلقائياً عند إدخال الـ PIN للبوت..."
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
            Telegram Allowed Chat IDs (المسموح لهم بالتفاعل مع البوت)
          </label>
          <input
            type="text"
            value={safeValues["TELEGRAM_ALLOWED_CHAT_IDS"] || ""}
            onChange={(e) => setValues({ ...safeValues, TELEGRAM_ALLOWED_CHAT_IDS: e.target.value })}
            className="glass-input font-mono text-sm"
            placeholder="مثال: 12345678, 87654321"
          />
        </div>
      </div>

      {/* ── Save ── */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full px-4 py-3 rounded-xl font-bold transition-all disabled:opacity-50 shadow-md text-white bg-blue-600 hover:bg-blue-700"
      >
        {saving ? "جاري الحفظ..." : "حفظ إعدادات الأدمن ⚙️"}
      </button>
      {saved && (
        <p className="text-center font-bold text-sm text-emerald-600">
          تم حفظ الإعدادات بنجاح ✓
        </p>
      )}
    </div>
  );
}

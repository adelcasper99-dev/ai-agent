// app/dashboard/settings/page.tsx
"use client";

import { useEffect, useState } from "react";

import TelegramSetupCard from "@/components/TelegramSetupCard";

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [adminPin, setAdminPin] = useState<string | null>(null);
  const [adminPinExpiry, setAdminPinExpiry] = useState<string | null>(null);
  const [generatingPin, setGeneratingPin] = useState(false);
  const [justLinked, setJustLinked] = useState(false);

  // Tenant-specific Telegram Business Setup state
  const [tenantSetup, setTenantSetup] = useState<{
    setupCode: string | null;
    businessConnectionActive: boolean;
    botUsername: string;
  }>({
    setupCode: null,
    businessConnectionActive: false,
    botUsername: "Casperaibot",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/dashboard/settings/tenant-setup").then((r) => r.json()).catch(() => ({}))
    ])
      .then(([settingsData, tenantData]) => {
        setValues(settingsData?.settings || {});
        if (tenantData?.success) {
          setTenantSetup({
            setupCode: tenantData.setupCode,
            businessConnectionActive: tenantData.businessConnectionActive,
            botUsername: tenantData.botUsername || "Casperaibot",
          });
        }
      })
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

  const handleGenerateTenantSetupCode = async () => {
    try {
      const res = await fetch("/api/dashboard/settings/tenant-setup", { method: "POST" });
      const data = await res.json();
      if (data.success && data.setupCode) {
        setTenantSetup(prev => ({ ...prev, setupCode: data.setupCode }));
        return data.setupCode;
      }
    } catch (err) {
      console.error("Failed to generate tenant setup code", err);
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
    <div className="space-y-6 max-w-4xl pb-10" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between bg-zinc-900/70 p-6 rounded-2xl border border-zinc-800 shadow-xl">
        <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
          <span className="p-2 rounded-xl bg-blue-600/10 text-blue-500 border border-blue-500/20">
            <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          إعدادات الأدمن والتليجرام
        </h2>
      </div>

      {/* ── Telegram Business Card ── */}
      <TelegramSetupCard
        initialSetupCode={tenantSetup.setupCode}
        businessConnectionActive={tenantSetup.businessConnectionActive}
        botUsername={tenantSetup.botUsername}
        onGenerateCode={handleGenerateTenantSetupCode}
      />

      {/* ── Telegram Admin Linking Card ── */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <label className="block text-sm font-semibold text-zinc-200">
            ربط وتحديث حساب الأدمن المباشر للتليجرام (Telegram Admin OTP Link)
          </label>
          <button
            type="button"
            onClick={generateAdminPin}
            disabled={generatingPin}
            className="px-4 py-2 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
          >
            {generatingPin ? "جاري التوليد..." : "+ توليد كود ربط جديد (PIN)"}
          </button>
        </div>

        {justLinked && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <span>تم ربط حساب التليجرام الخاص بك كأدمن مباشر بنجاح! Chat ID: <strong dir="ltr" className="font-mono">{safeValues["ADMIN_TELEGRAM_CHAT_ID"]}</strong></span>
          </div>
        )}

        {/* Live Status Badge */}
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${safeValues["ADMIN_TELEGRAM_CHAT_ID"] ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <span className="text-xs font-medium text-zinc-300">
              {safeValues["ADMIN_TELEGRAM_CHAT_ID"] ? "الحساب مرتبط ومفعل لاستقبال الطلبات والتنبيهات" : "لم يتم ربط حساب أدمن تليجرام بعد"}
            </span>
          </div>
          {safeValues["ADMIN_TELEGRAM_CHAT_ID"] && (
            <span className="text-xs font-mono font-semibold bg-blue-600/10 text-blue-400 px-3 py-1 rounded-lg border border-blue-500/20" dir="ltr">
              Chat ID: {safeValues["ADMIN_TELEGRAM_CHAT_ID"]}
            </span>
          )}
        </div>

        {adminPin ? (
          <div className="p-5 rounded-xl bg-zinc-950 border border-blue-500/30 text-center space-y-2">
            <p className="text-xs text-zinc-400 font-medium">افتح التليجرام وارسل هذا الكود للبوت المشترك قبل انتهاء الصلاحية (5 دقائق):</p>
            <div className="text-3xl font-extrabold font-mono tracking-widest text-blue-400 select-all py-2" dir="ltr">
              {adminPin}
            </div>
            <p className="text-xs text-zinc-400">ينتهي الكود في: {new Date(adminPinExpiry || "").toLocaleTimeString("ar-EG")}</p>
            <p className="text-xs text-emerald-400 font-semibold">في انتظار إرسالك للكود من الهاتف... (سيتم الربط والتحديث تلقائياً)</p>
          </div>
        ) : (
          <p className="text-xs text-zinc-400">
            انقر على "توليد كود ربط جديد" لإنشاء كود من 4 أرقام مدته 5 دقائق. بمجرد إرسال الكود للبوت يتم ربط حسابك فورياً.
          </p>
        )}
      </div>

      {/* ── Telegram Admin & Bot Config ── */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
          إعدادات التليجرام وبوت المنصة
        </h3>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-300">
            Admin Telegram Chat ID (معرف التليجرام المسجل حالياً لاستقبال التنبيهات)
          </label>
          <input
            type="text"
            dir="ltr"
            value={safeValues["ADMIN_TELEGRAM_CHAT_ID"] || ""}
            onChange={(e) => setValues({ ...safeValues, ADMIN_TELEGRAM_CHAT_ID: e.target.value })}
            className="w-full h-11 px-4 bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 transition-colors font-mono text-sm rounded-xl outline-none"
            placeholder="يتم تحديثه تلقائياً عند إدخال الـ PIN للبوت..."
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-300">
            Telegram Allowed Chat IDs (المسموح لهم بالتفاعل مع البوت)
          </label>
          <input
            type="text"
            dir="ltr"
            value={safeValues["TELEGRAM_ALLOWED_CHAT_IDS"] || ""}
            onChange={(e) => setValues({ ...safeValues, TELEGRAM_ALLOWED_CHAT_IDS: e.target.value })}
            className="w-full h-11 px-4 bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 transition-colors font-mono text-sm rounded-xl outline-none"
            placeholder="مثال: 12345678, 87654321"
          />
        </div>
      </div>

      {/* ── Save ── */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full h-12 rounded-xl font-bold transition-all disabled:opacity-50 text-white bg-blue-600 hover:bg-blue-500 text-sm shadow-md"
      >
        {saving ? "جاري الحفظ..." : "حفظ إعدادات الأدمن"}
      </button>
      {saved && (
        <p className="text-center font-semibold text-sm text-emerald-400">
          تم حفظ الإعدادات بنجاح ✓
        </p>
      )}
    </div>
  );
}

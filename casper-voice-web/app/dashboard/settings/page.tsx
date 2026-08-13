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
      <div className="flex items-center justify-between bg-zinc-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl mb-6">
        <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">⚙️</span>
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
      <div className="bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 space-y-4 relative overflow-hidden group shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-cyan-500/10 transition-colors" />
        <div className="flex justify-between items-center relative z-10">
          <label className="block text-sm font-bold flex items-center gap-1.5 text-white">
            📲 ربط وتحديث حساب الأدمن المباشر للتليجرام (Telegram Admin OTP Link)
          </label>
          <button
            type="button"
            onClick={generateAdminPin}
            disabled={generatingPin}
            className="px-4 py-2 rounded-xl font-bold text-xs bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all hover:bg-cyan-400"
          >
            {generatingPin ? "جاري التوليد..." : "⚡ توليد كود ربط جديد (PIN)"}
          </button>
        </div>

        {justLinked && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-bounce">
            <span>🎉</span>
            <span>تم ربط حساب التليجرام الخاص بك كأدمن مباشر بنجاح! Chat ID: <strong>{safeValues["ADMIN_TELEGRAM_CHAT_ID"]}</strong></span>
          </div>
        )}

        {/* Live Status Badge */}
        <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-white/5 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${safeValues["ADMIN_TELEGRAM_CHAT_ID"] ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <span className="text-xs font-bold text-zinc-300">
              {safeValues["ADMIN_TELEGRAM_CHAT_ID"] ? "الحساب مرتبط ومفعل لاستقبال الطلبات والتنبيهات" : "لم يتم ربط حساب أدمن تليجرام بعد"}
            </span>
          </div>
          {safeValues["ADMIN_TELEGRAM_CHAT_ID"] && (
            <span className="text-xs font-mono font-bold bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-lg border border-cyan-500/20">
              Chat ID: {safeValues["ADMIN_TELEGRAM_CHAT_ID"]}
            </span>
          )}
        </div>

        {adminPin ? (
          <div className="p-5 rounded-2xl bg-zinc-950 border border-cyan-500/30 text-center space-y-2 relative z-10">
            <p className="text-xs text-zinc-400 font-medium">افتح التليجرام وارسل هذا الكود للبوت المشترك قبل انتهاء الصلاحية (5 دقائق):</p>
            <div className="text-3xl font-extrabold font-mono tracking-widest text-cyan-400 select-all py-2">
              {adminPin}
            </div>
            <p className="text-xs text-zinc-400">ينتهي الكود في: {new Date(adminPinExpiry || "").toLocaleTimeString("ar-EG")}</p>
            <p className="text-xs text-emerald-400 font-bold animate-pulse">⚡ في انتظار إرسالك للكود من الهاتف... (سيتم الربط والتحديث تلقائياً بمجرد إرساله)</p>
          </div>
        ) : (
          <p className="text-xs text-zinc-400 relative z-10">
            انقر على "توليد كود ربط جديد" لإنشاء كود من 4 أرقام مدته 5 دقائق. بمجرد إرسال الكود للبوت في التليجرام يتم ربط حسابك كأدمن مباشر فورياً.
          </p>
        )}
      </div>

      {/* ── Telegram Admin & Bot Config ── */}
      <div className="bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl">
        <h3 className="font-bold text-base text-white flex items-center gap-2">
          🤖 إعدادات التليجرام وبوت المنصة
        </h3>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-zinc-300">
            Admin Telegram Chat ID 📲 (معرف التليجرام المسجل حالياً لاستقبال التنبيهات)
          </label>
          <input
            type="text"
            value={safeValues["ADMIN_TELEGRAM_CHAT_ID"] || ""}
            onChange={(e) => setValues({ ...safeValues, ADMIN_TELEGRAM_CHAT_ID: e.target.value })}
            className="w-full h-12 px-4 bg-zinc-900/50 border border-white/10 text-white placeholder:text-zinc-500 focus:border-white transition-all font-mono text-sm rounded-2xl outline-none"
            placeholder="يتم تحديثه تلقائياً عند إدخال الـ PIN للبوت..."
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-zinc-300">
            Telegram Allowed Chat IDs (المسموح لهم بالتفاعل مع البوت)
          </label>
          <input
            type="text"
            value={safeValues["TELEGRAM_ALLOWED_CHAT_IDS"] || ""}
            onChange={(e) => setValues({ ...safeValues, TELEGRAM_ALLOWED_CHAT_IDS: e.target.value })}
            className="w-full h-12 px-4 bg-zinc-900/50 border border-white/10 text-white placeholder:text-zinc-500 focus:border-white transition-all font-mono text-sm rounded-2xl outline-none"
            placeholder="مثال: 12345678, 87654321"
          />
        </div>
      </div>

      {/* ── Save ── */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full h-14 rounded-2xl font-black transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(6,182,212,0.4)] text-black bg-cyan-500 hover:bg-cyan-400 text-sm"
      >
        {saving ? "جاري الحفظ..." : "حفظ إعدادات الأدمن ⚙️"}
      </button>
      {saved && (
        <p className="text-center font-bold text-sm text-emerald-400 animate-pulse">
          تم حفظ الإعدادات بنجاح ✓
        </p>
      )}
    </div>
  );
}

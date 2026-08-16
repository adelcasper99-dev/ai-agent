// app/dashboard/settings/page.tsx
"use client";

import { useEffect, useState } from "react";

import { Settings, ShieldCheck, Key, CheckCircle2, Sparkles, Send } from "lucide-react";
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
        <div className="glass-card-lg p-6 space-y-4 animate-pulse">
          <div className="h-5 w-48 rounded-full bg-slate-700/50" />
          {[1,2,3].map(i => <div key={i} className="h-12 w-full rounded-xl bg-slate-700/30" />)}
        </div>
      </div>
    );
  }

  const safeValues = values || {};

  return (
    <div className="space-y-6 max-w-4xl pb-10" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between glass-card-lg p-6 rounded-2xl border border-slate-700/60 shadow-xl">
        <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Settings className="w-5 h-5" />
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
      <div className="glass-card-lg border border-slate-700/60 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <label className="block text-sm font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            ربط وتحديث حساب الأدمن المباشر للتليجرام (Telegram Admin OTP Link)
          </label>
          <button
            type="button"
            onClick={generateAdminPin}
            disabled={generatingPin}
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-cyan-500 hover:bg-cyan-400 text-black transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
          >
            {generatingPin ? "جاري التوليد..." : "+ توليد كود ربط جديد (PIN)"}
          </button>
        </div>

        {justLinked && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>تم ربط حساب التليجرام الخاص بك كأدمن مباشر بنجاح! Chat ID: <strong dir="ltr" className="font-mono">{safeValues["ADMIN_TELEGRAM_CHAT_ID"]}</strong></span>
          </div>
        )}

        {/* Live Status Badge */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${safeValues["ADMIN_TELEGRAM_CHAT_ID"] ? "bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]" : "bg-amber-400"}`} />
            <span className="text-xs font-semibold text-slate-200">
              {safeValues["ADMIN_TELEGRAM_CHAT_ID"] ? "الحساب مرتبط ومفعل لاستقبال الطلبات والتنبيهات" : "لم يتم ربط حساب أدمن تليجرام بعد"}
            </span>
          </div>
          {safeValues["ADMIN_TELEGRAM_CHAT_ID"] && (
            <span className="text-xs font-mono font-extrabold bg-cyan-500/10 text-cyan-400 px-3 py-1.5 rounded-lg border border-cyan-500/20" dir="ltr">
              Chat ID: {safeValues["ADMIN_TELEGRAM_CHAT_ID"]}
            </span>
          )}
        </div>

        {adminPin ? (
          <div className="p-5 rounded-xl bg-slate-900/80 border border-cyan-500/40 text-center space-y-2">
            <p className="text-xs text-slate-300 font-medium">افتح التليجرام وارسل هذا الكود للبوت المشترك قبل انتهاء الصلاحية (5 دقائق):</p>
            <div className="text-3xl font-black font-mono tracking-widest text-cyan-400 select-all py-2" dir="ltr">
              {adminPin}
            </div>
            <p className="text-xs text-slate-400">ينتهي الكود في: {new Date(adminPinExpiry || "").toLocaleTimeString("ar-EG")}</p>
            <p className="text-xs text-emerald-400 font-bold flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              في انتظار إرسالك للكود من الهاتف... (سيتم الربط والتحديث تلقائياً)
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            انقر على "توليد كود ربط جديد" لإنشاء كود من 4 أرقام مدته 5 دقائق. بمجرد إرسال الكود للبوت يتم ربط حسابك فورياً.
          </p>
        )}
      </div>

      {/* ── Telegram Admin & Bot Config ── */}
      <div className="glass-card-lg border border-slate-700/60 rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
          <Send className="w-4 h-4 text-cyan-400" />
          إعدادات التليجرام وبوت المنصة
        </h3>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-200">
            Admin Telegram Chat ID (معرف التليجرام المسجل حالياً لاستقبال التنبيهات)
          </label>
          <input
            type="text"
            dir="ltr"
            value={safeValues["ADMIN_TELEGRAM_CHAT_ID"] || ""}
            onChange={(e) => setValues({ ...safeValues, ADMIN_TELEGRAM_CHAT_ID: e.target.value })}
            className="glass-input font-mono text-sm"
            placeholder="يتم تحديثه تلقائياً عند إدخال الـ PIN للبوت..."
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-200">
            Telegram Allowed Chat IDs (المسموح لهم بالتفاعل مع البوت)
          </label>
          <input
            type="text"
            dir="ltr"
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
        className="w-full h-12 rounded-xl font-extrabold transition-all disabled:opacity-50 text-black bg-cyan-500 hover:bg-cyan-400 text-sm shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-[1.01] active:scale-[0.99]"
      >
        {saving ? "جاري الحفظ..." : "حفظ إعدادات الأدمن"}
      </button>
      {saved && (
        <p className="text-center font-bold text-sm text-emerald-400 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" />
          تم حفظ الإعدادات بنجاح ✓
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

interface TelegramSetupCardProps {
  initialSetupCode?: string | null;
  businessConnectionActive?: boolean;
  botUsername?: string;
  onGenerateCode?: () => Promise<string | void>;
}

export default function TelegramSetupCard({
  initialSetupCode = null,
  businessConnectionActive = false,
  botUsername = "Casperaibot",
  onGenerateCode,
}: TelegramSetupCardProps) {
  const [setupCode, setSetupCode] = useState<string | null>(initialSetupCode);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (onGenerateCode) {
      setGenerating(true);
      try {
        const code = await onGenerateCode();
        if (typeof code === "string") {
          setSetupCode(code);
        }
      } finally {
        setGenerating(false);
      }
    }
  };

  const copyCode = () => {
    if (!setupCode) return;
    navigator.clipboard.writeText(setupCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const deepLink = setupCode
    ? `https://t.me/${botUsername}?start=${setupCode}`
    : `https://t.me/${botUsername}`;

  return (
    <div
      dir="rtl"
      className="w-full max-w-2xl mx-auto rounded-2xl p-6 sm:p-7 space-y-6 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.005] backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-lg"
    >
      {/* ── 1. Header Area ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#24A1DE]/10 text-[#24A1DE] flex items-center justify-center shrink-0 shadow-inner">
            <svg
              className="w-7 h-7 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.02-1.38-.27-2.05-.49-.83-.27-1.49-.42-1.43-.89.03-.25.38-.51 1.07-.78 4.18-1.82 6.97-3.02 8.37-3.61 3.98-1.66 4.81-1.95 5.35-1.96.12 0 .38.03.55.17.14.12.18.28.2.46-.02.07-.02.16-.04.22z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              ربط تليجرام بيزنس (Telegram Business)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ربط حسابك المباشر لاستقبال ردود الذكاء الاصطناعي على رسائل عملائك
            </p>
          </div>
        </div>

        {/* Live Status Badge */}
        <div
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold self-start sm:self-center transition-colors ${
            businessConnectionActive
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              businessConnectionActive
                ? "bg-emerald-500 animate-pulse"
                : "bg-rose-500"
            }`}
          />
          {businessConnectionActive ? "🟢 الربط مفعل ونشط" : "🔴 غير مرتبط"}
        </div>
      </div>

      {/* ── 2. Body Area ── */}
      <div className="space-y-4">
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          قم بربط حساب التليجرام الخاص بشركتك ليتمكن مساعد Casper الذكي من الرد تلقائياً على استفسارات عملائك وتنفيذ الأوامر المباشرة.
        </p>

        {/* Setup Code Section */}
        <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700 space-y-3">
          <div className="flex justify-between items-center text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>كود الربط الخاص بشركتك (Setup Code)</span>
            {!setupCode && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="text-xs text-[#24A1DE] font-bold hover:underline disabled:opacity-50"
              >
                {generating ? "جاري التوليد..." : "⚡ إنشاء كود جديد"}
              </button>
            )}
          </div>

          {setupCode ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-xl sm:text-2xl font-bold tracking-[0.2em] text-center bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-3 rounded-lg border border-slate-200 dark:border-slate-700 select-all shadow-inner">
                {setupCode}
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
              >
                {copied ? "✓ تم النسخ" : "📋 نسخ"}
              </button>
            </div>
          ) : (
            <div className="text-center py-2 text-xs text-slate-400">
              انقر على "إنشاء كود جديد" للحصول على رابط التفعيل السريع.
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Action Footer ── */}
      <div className="space-y-3 pt-2">
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3.5 px-4 bg-[#24A1DE] hover:bg-[#208fc7] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(36,161,222,0.3)] hover:shadow-[0_0_20px_rgba(36,161,222,0.5)] transition-all duration-300 active:scale-[0.99]"
        >
          <span>📱</span>
          <span>افتح التليجرام وابدأ التفعيل المباشر</span>
        </a>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
          💡 تنبيه: ربط تليجرام بيزنس يتطلب تفعيل اشتراك Telegram Premium على حسابك الشخصي.
        </p>
      </div>
    </div>
  );
}

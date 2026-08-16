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
      className="w-full max-w-4xl mx-auto rounded-2xl p-6 sm:p-7 space-y-6 glass-card-lg border border-slate-700/60 shadow-2xl transition-all duration-200"
    >
      {/* ── 1. Header Area ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600/10 text-blue-500 flex items-center justify-center shrink-0 border border-blue-500/20">
            <svg
              className="w-6 h-6 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.02-1.38-.27-2.05-.49-.83-.27-1.49-.42-1.43-.89.03-.25.38-.51 1.07-.78 4.18-1.82 6.97-3.02 8.37-3.61 3.98-1.66 4.81-1.95 5.35-1.96.12 0 .38.03.55.17.14.12.18.28.2.46-.02.07-.02.16-.04.22z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100 tracking-tight flex items-center gap-2">
              ربط تليجرام بيزنس (Telegram Business)
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              ربط حسابك المباشر لاستقبال ردود الذكاء الاصطناعي على رسائل عملائك
            </p>
          </div>
        </div>

        {/* Live Status Badge */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold self-start sm:self-center border transition-colors ${
            businessConnectionActive
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-zinc-800/80 text-zinc-400 border-zinc-700"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              businessConnectionActive
                ? "bg-emerald-500 animate-pulse"
                : "bg-zinc-500"
            }`}
          />
          {businessConnectionActive ? "الربط مفعل ونشط" : "غير مرتبط حالياً"}
        </div>
      </div>

      {/* ── 2. Body Area ── */}
      <div className="space-y-4">
        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
          قم بربط حساب التليجرام الخاص بشركتك ليتمكن مساعد Casper الذكي من الرد تلقائياً على استفسارات عملائك وتنفيذ الأوامر المباشرة.
        </p>

        {/* Setup Code Section */}
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
          <div className="flex justify-between items-center text-xs font-medium text-zinc-400">
            <span>كود الربط الخاص بشركتك (Setup Code)</span>
            {!setupCode && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="text-xs text-blue-400 font-semibold hover:text-blue-300 disabled:opacity-50 transition-colors"
              >
                {generating ? "جاري التوليد..." : "+ إنشاء كود جديد"}
              </button>
            )}
          </div>

          {setupCode ? (
            <div className="flex items-center gap-2" dir="ltr">
              <div className="flex-1 font-mono text-xl sm:text-2xl font-bold tracking-[0.2em] text-center bg-zinc-900 text-zinc-100 p-3 rounded-lg border border-zinc-800 select-all">
                {setupCode}
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5"
              >
                {copied ? "✓ تم النسخ" : "نسخ الكود"}
              </button>
            </div>
          ) : (
            <div className="text-center py-2 text-xs text-zinc-500">
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
          className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.02-1.38-.27-2.05-.49-.83-.27-1.49-.42-1.43-.89.03-.25.38-.51 1.07-.78 4.18-1.82 6.97-3.02 8.37-3.61 3.98-1.66 4.81-1.95 5.35-1.96.12 0 .38.03.55.17.14.12.18.28.2.46-.02.07-.02.16-.04.22z" />
          </svg>
          <span>افتح التليجرام وابدأ التفعيل المباشر</span>
        </a>

        <p className="text-[12px] text-zinc-500 text-center">
          تنبيه: ربط تليجرام بيزنس يتطلب تفعيل اشتراك Telegram Premium على حسابك.
        </p>
      </div>
    </div>
  );
}

// app/dashboard/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import VoiceCallModal from "@/components/VoiceCallModal";

const TABS = [
  { href: "/dashboard/settings", label: "المفاتيح" },
  { href: "/dashboard/tenants", label: "🏢 طلبات الشركات والتفعيل" },
  { href: "/dashboard/chat", label: "✈️ محاكي التليجرام" },
  { href: "/dashboard/logs", label: "اللوجز المباشرة 📡" },
  { href: "/dashboard/conversations", label: "المحادثات" },
  { href: "/dashboard/data", label: "تغذية البيانات" },
  { href: "/dashboard/reports", label: "التقارير" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDiagOpen, setIsDiagOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagData, setDiagData] = useState<any>(null);

  const runDiagnostics = async () => {
    setIsDiagOpen(true);
    setDiagLoading(true);
    try {
      const res = await fetch("/api/health/voice");
      const data = await res.json();
      setDiagData(data);
    } catch {
      setDiagData({ status: "UNHEALTHY", diagnostics: { CONNECTION: { status: "FAIL", detail: "فشل الاتصال بمسار التشخيص" } } });
    } finally {
      setDiagLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6" dir="rtl">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">لوحة تحكم كاسبر</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={runDiagnostics}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition"
          >
            🩺 تشخيص الصوت اللحظي
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg transition"
          >
            🎤 اختبار المساعد الصوتي
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 border-b-2 whitespace-nowrap ${
              pathname === tab.href
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      
      {children}

      {/* Instant Voice Health Diagnostic Modal */}
      {isDiagOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 text-white shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-base flex items-center gap-2">
                <span>🩺</span> تقرير التشخيص اللحظي لنظام الصوت
              </h3>
              <button onClick={() => setIsDiagOpen(false)} className="text-slate-400 hover:text-white font-bold text-sm">✕</button>
            </div>

            {diagLoading ? (
              <div className="py-8 text-center text-xs text-sky-400 font-bold animate-pulse">
                جاري فحص الـ Middleware وقاعدة البيانات وسيرفر LiveKit وسيرفرات الذكاء الاصطناعي...
              </div>
            ) : diagData ? (
              <div className="space-y-3">
                <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                  diagData.status === "HEALTHY" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}>
                  <span>حالة النظام الإجمالية:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800">
                    {diagData.status === "HEALTHY" ? "✅ سليم وجاهز 100%" : "🚨 يوجد خلل في الإعدادات"}
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {Object.entries(diagData.diagnostics || {}).map(([key, item]: [string, any]) => (
                    <div key={key} className="bg-slate-800/80 p-2.5 rounded-lg text-xs flex items-start justify-between gap-2 border border-slate-700/60">
                      <div>
                        <span className="font-mono text-[10px] text-slate-400 block">{key}</span>
                        <span className="font-bold text-slate-200">{item.detail}</span>
                      </div>
                      <span className="text-sm shrink-0">{item.status === "OK" ? "🟢" : "🔴"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <button 
              onClick={() => setIsDiagOpen(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition"
            >
              إغلاق التقارير
            </button>
          </div>
        </div>
      )}

      <VoiceCallModal 
        isOpen={isModalOpen} 
        mode="customer_service" 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}

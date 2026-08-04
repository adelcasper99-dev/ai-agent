// app/dashboard/chat/page.tsx
"use client";
import dynamic from "next/dynamic";

const TelegramSimulator = dynamic(() => import("@/components/TelegramSimulator"), { ssr: false });

export default function ChatPage() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 pb-10" dir="rtl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
            ✈️ محاكي بوت التليجرام (Telegram Offline Simulator)
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
            اختبر الأنماط الثلاثة في مكان واحد قبل الإطلاق: كتابة نصية • تسجيل فويس نوت • مكالمة هاتفية حية 📞
          </p>
        </div>
      </div>
      <TelegramSimulator />
    </div>
  );
}

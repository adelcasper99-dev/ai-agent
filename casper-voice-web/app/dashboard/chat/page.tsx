// app/dashboard/chat/page.tsx
"use client";
import dynamic from "next/dynamic";

const TelegramSimulator = dynamic(() => import("@/components/TelegramSimulator"), { ssr: false });

export default function ChatPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            ✈️ محاكي بوت التليجرام (Telegram Offline Simulator)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            اختبر الأنماط الثلاثة في مكان واحد قبل الإطلاق: كتابة نصية • تسجيل فويس نوت • مكالمة هاتفية حية 📞
          </p>
        </div>
      </div>
      <TelegramSimulator />
    </div>
  );
}

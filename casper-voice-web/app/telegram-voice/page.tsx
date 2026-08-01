"use client";

import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Suspense } from "react";

const VoiceCallModal = dynamic(() => import("@/components/VoiceCallModal"), { ssr: false });

function TelegramVoiceContent() {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get("tenantId") || undefined;

  return (
    <div className="min-h-screen bg-[#020817] flex flex-col items-center justify-center p-4">
      <VoiceCallModal 
        isOpen={true} 
        mode="customer_service" 
        onClose={() => {
          if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
            (window as any).Telegram.WebApp.close();
          }
        }} 
        tenantId={tenantId}
      />
    </div>
  );
}

export default function TelegramVoicePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#020817] text-white flex items-center justify-center">جاري التحميل...</div>}>
      <TelegramVoiceContent />
    </Suspense>
  );
}

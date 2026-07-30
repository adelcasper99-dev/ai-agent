// app/dashboard/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import VoiceCallModal from "@/components/VoiceCallModal";

const TABS = [
  { href: "/dashboard/settings", label: "المفاتيح" },
  { href: "/dashboard/chat", label: "✈️ محاكي التليجرام" },
  { href: "/dashboard/logs", label: "اللوجز المباشرة 📡" },
  { href: "/dashboard/conversations", label: "المحادثات" },
  { href: "/dashboard/data", label: "تغذية البيانات" },
  { href: "/dashboard/reports", label: "التقارير" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="max-w-5xl mx-auto p-6" dir="rtl">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">لوحة تحكم كاسبر</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg"
        >
          🎤 اختبار المساعد الصوتي
        </button>
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

      <VoiceCallModal 
        isOpen={isModalOpen} 
        mode="customer_service" 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}

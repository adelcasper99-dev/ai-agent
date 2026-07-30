// app/dashboard/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/settings", label: "المفاتيح" },
  { href: "/dashboard/conversations", label: "المحادثات" },
  { href: "/dashboard/data", label: "تغذية البيانات" },
  { href: "/dashboard/reports", label: "التقارير" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">لوحة تحكم كاسبر</h1>
      <div className="flex gap-2 border-b mb-6">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 border-b-2 ${
              pathname === tab.href
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-gray-500"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}

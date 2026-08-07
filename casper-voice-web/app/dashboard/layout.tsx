// app/dashboard/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  Key, Building2, Sparkles, Send, LayoutDashboard,
  MessageSquare, Database, BarChart3, LogOut,
  Mic, Stethoscope, RefreshCw, Settings,
} from "lucide-react";
import VoiceCallModal from "@/components/VoiceCallModal";

// ── Tab routing — matches existing file-based routes exactly ──────────────────
const TABS = [
  { href: "/dashboard/settings",      label: "الإعدادات",                   Icon: Settings },
  { href: "/dashboard/voice",         label: "المساعد الصوتي",              Icon: Mic },
  { href: "/dashboard/keys",          label: "المفاتيح",                    Icon: Key },
  { href: "/dashboard/tenants",       label: "طلبات الشركات والتفعيل",      Icon: Building2 },
  { href: "/dashboard/api-keys",      label: "مفاتيح Gemini",               Icon: Sparkles },
  { href: "/dashboard/chat",          label: "محاكي التليجرام",             Icon: Send },
  { href: "/dashboard/logs",          label: "اللوجز المباشرة",             Icon: LayoutDashboard },
  { href: "/dashboard/conversations", label: "المحادثات",                   Icon: MessageSquare },
  { href: "/dashboard/data",          label: "تغذية البيانات",              Icon: Database },
  { href: "/dashboard/reports",       label: "التقارير",                    Icon: BarChart3 },
] as const;

// ── Page title map ────────────────────────────────────────────────────────────
const PAGE_TITLES: Record<string, string> = {
  "/dashboard/settings":      "الإعدادات وإدارة البوت",
  "/dashboard/voice":         "إعدادات المساعد ونبرة الصوت",
  "/dashboard/keys":          "المفاتيح والاستخدام",
  "/dashboard/tenants":       "طلبات الشركات والتفعيل",
  "/dashboard/api-keys":      "مفاتيح Gemini",
  "/dashboard/chat":          "محاكي التليجرام",
  "/dashboard/logs":          "اللوجز المباشرة",
  "/dashboard/conversations": "المحادثات",
  "/dashboard/data":          "تغذية البيانات",
  "/dashboard/reports":       "التقارير",
};

// ── Diagnostics types ─────────────────────────────────────────────────────────
interface DiagItem { status: string; detail: string; }
interface DiagData  { status: string; diagnostics?: Record<string, DiagItem>; }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [isVoiceOpen, setIsVoiceOpen]   = useState(false);
  const [isDiagOpen,  setIsDiagOpen]    = useState(false);
  const [diagLoading, setDiagLoading]   = useState(false);
  const [diagData,    setDiagData]      = useState<DiagData | null>(null);

  // ── Theme state ─────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("casper-theme");
    const dark   = stored !== "light";
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("casper-theme", next ? "dark" : "light");
  };

  // ── Diagnostics ─────────────────────────────────────────────────────────────
  const runDiagnostics = useCallback(async () => {
    setIsDiagOpen(true);
    setDiagLoading(true);
    try {
      const res  = await fetch("/api/health/voice");
      const data = await res.json();
      setDiagData(data);
    } catch {
      setDiagData({
        status: "UNHEALTHY",
        diagnostics: {
          CONNECTION: { status: "FAIL", detail: "فشل الاتصال بمسار التشخيص" },
        },
      });
    } finally {
      setDiagLoading(false);
    }
  }, []);

  // ── Logout ──────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const pageTitle = PAGE_TITLES[pathname] ?? "لوحة التحكم";

  // ── Shared button base ──────────────────────────────────────────────────────
  const btnBase =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer border-0 transition-all duration-200 whitespace-nowrap";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>
      {/* ════════════════════════════════════════════
          ICON RAIL — Solid Sidebar (Right edge in RTL)
      ════════════════════════════════════════════ */}
      <aside 
        className="flex-shrink-0 flex flex-col z-40 overflow-y-auto"
        style={{
          width: "var(--sidebar-w)",
          background: "var(--sidebar-bg)",
          borderLeft: "1px solid var(--sidebar-border)",
          color: "var(--sidebar-text)"
        }}
      >
        {/* Logo block */}
        <div 
          className="flex items-center justify-center flex-shrink-0"
          style={{ height: "var(--topbar-h)", borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-lg"
              style={{ background: "#ffffff", color: "#000000", fontFamily: "var(--pr-font-primary)" }}
            >
              C
            </div>
            <span className="font-bold text-lg tracking-tight">كاسبر فويس</span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {TABS.map(({ href, label, Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200"
                style={{
                  background: isActive ? "var(--primary)" : "transparent",
                  color: isActive ? "var(--primary-foreground)" : "rgba(248,250,252,0.7)",
                }}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-sm font-semibold">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-red-500/10 text-red-400 hover:text-red-300"
          >
            <LogOut size={20} />
            <span className="text-sm font-semibold">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          MAIN CONTENT AREA
      ════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP BAR */}
        <header
          className="flex-shrink-0 flex items-center justify-between px-8 z-30"
          style={{
            height: "var(--topbar-h)",
            background: "var(--background)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {/* Page title */}
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--foreground)" }}>
            {pageTitle}
          </h1>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Test voice assistant — Solid cyan button */}
            <button
              onClick={() => setIsVoiceOpen(true)}
              className={btnBase + " shadow-sm"}
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
                padding: "10px 20px",
              }}
            >
              <Mic size={16} />
              <span className="hidden sm:inline">اختبار المساعد الصوتي</span>
            </button>

            {/* Live diagnostics */}
            <button
              onClick={runDiagnostics}
              className={btnBase + " solid-card hover:bg-slate-50"}
              style={{
                color: "var(--foreground)",
                padding: "10px 20px",
                border: "1px solid var(--border)",
              }}
            >
              <Stethoscope size={16} className="text-blue-500" />
              <span className="hidden sm:inline">تشخيص الصوت اللحظي</span>
            </button>
          </div>
        </header>

        {/* SCROLLABLE BODY */}
        <main className="flex-1 overflow-y-auto p-8" style={{ background: "var(--background)" }}>
          <div className="casper-fade-up max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* ════════════════════════════════════════════
          DIAGNOSTICS MODAL
      ════════════════════════════════════════════ */}
      {isDiagOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(6px)" }}
        >
          <div
            className="rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl"
            style={{
              background: "rgba(5,5,8,0.95)",
              border: "1px solid var(--color-border-glass)",
            }}
          >
            {/* Modal header */}
            <div
              className="flex justify-between items-center pb-3"
              style={{ borderBottom: "1px solid var(--color-border-glass)" }}
            >
              <h3
                className="font-black text-base flex items-center gap-2"
                style={{ color: "var(--color-text-primary)" }}
              >
                <Stethoscope size={16} style={{ color: "var(--color-info)" }} />
                تقرير التشخيص اللحظي لنظام الصوت
              </h3>
              <button
                onClick={() => setIsDiagOpen(false)}
                className="text-sm font-bold"
                style={{ color: "var(--color-text-muted)" }}
              >
                ✕
              </button>
            </div>

            {diagLoading ? (
              <div
                className="py-8 text-center text-xs font-bold animate-pulse"
                style={{ color: "var(--color-info)" }}
              >
                جاري فحص الـ Middleware وقاعدة البيانات وسيرفر LiveKit وسيرفرات الذكاء الاصطناعي...
              </div>
            ) : diagData ? (
              <div className="space-y-3">
                {/* Overall status */}
                <div
                  className="p-3 rounded-xl flex items-center justify-between text-xs font-bold"
                  style={{
                    background: diagData.status === "HEALTHY"
                      ? "rgba(21,132,110,0.12)"
                      : "rgba(229,72,77,0.12)",
                    border: `1px solid ${diagData.status === "HEALTHY"
                      ? "rgba(21,132,110,0.30)"
                      : "rgba(229,72,77,0.30)"}`,
                    color: diagData.status === "HEALTHY"
                      ? "#1fc9a4"
                      : "var(--color-danger)",
                  }}
                >
                  <span>حالة النظام الإجمالية:</span>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs"
                    style={{ background: "rgba(255,255,255,0.06)", color: "var(--color-text-primary)" }}
                  >
                    {diagData.status === "HEALTHY"
                      ? "✅ سليم وجاهز 100%"
                      : "🚨 يوجد خلل في الإعدادات"}
                  </span>
                </div>

                {/* Detail rows */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {Object.entries(diagData.diagnostics ?? {}).map(([key, item]) => (
                    <div
                      key={key}
                      className="p-2.5 rounded-lg text-xs flex items-start justify-between gap-2"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--color-border-glass)",
                      }}
                    >
                      <div>
                        <span className="block font-mono text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                          {key}
                        </span>
                        <span className="font-bold" style={{ color: "var(--color-text-secondary)" }}>
                          {item.detail}
                        </span>
                      </div>
                      <span className="text-sm shrink-0">
                        {item.status === "OK" ? "🟢" : "🔴"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Refresh + Close */}
            <div className="flex gap-2">
              <button
                onClick={runDiagnostics}
                disabled={diagLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: "rgba(128,82,255,0.15)",
                  border: "1px solid rgba(128,82,255,0.30)",
                  color: "var(--color-brand)",
                }}
              >
                <RefreshCw size={12} className={diagLoading ? "animate-spin" : ""} />
                إعادة الفحص
              </button>
              <button
                onClick={() => setIsDiagOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--color-border-glass)",
                  color: "var(--color-text-secondary)",
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice call modal — existing component, untouched */}
      <VoiceCallModal
        isOpen={isVoiceOpen}
        mode="customer_service"
        onClose={() => setIsVoiceOpen(false)}
      />
    </div>
  );
}

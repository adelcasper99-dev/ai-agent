// app/dashboard/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  Key, Building2, Sparkles, Send, LayoutDashboard,
  MessageSquare, Database, BarChart3, LogOut,
  Mic, Stethoscope, RefreshCw,
} from "lucide-react";
import VoiceCallModal from "@/components/VoiceCallModal";

// ── Tab routing — matches existing file-based routes exactly ──────────────────
const TABS = [
  { href: "/dashboard/settings",      label: "المفاتيح",                    Icon: Key },
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
  "/dashboard/settings":      "المفاتيح والاستخدام",
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
    <div
      className="flex flex-col min-h-screen"
      style={{ background: "var(--color-surface-base)" }}
    >
      {/* ════════════════════════════════════════════
          TOP BAR
      ════════════════════════════════════════════ */}
      <header
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-5"
        style={{
          height: "var(--topbar-h)",
          background: "var(--color-surface-topbar)",
          backdropFilter: "var(--backdrop-card)",
          WebkitBackdropFilter: "var(--backdrop-card)",
          borderBottom: "1px solid var(--color-border-glass)",
        }}
      >
        {/* Page title — RTL so this sits on the right */}
        <span
          className="text-lg font-bold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {pageTitle}
        </span>

        {/* Actions — RTL so these sit on the left */}
        <div className="flex items-center gap-2">

          {/* Logout — danger */}
          <button
            onClick={handleLogout}
            className={btnBase}
            style={{
              background: "rgba(229,72,77,0.12)",
              color: "var(--color-danger)",
              border: "1px solid rgba(229,72,77,0.28)",
            }}
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">تسجيل خروج</span>
          </button>

          {/* Test voice assistant — primary purple */}
          <button
            onClick={() => setIsVoiceOpen(true)}
            className={btnBase}
            style={{
              background: "var(--color-brand)",
              color: "#fff",
            }}
          >
            <Mic size={13} />
            <span className="hidden sm:inline">اختبار المساعد الصوتي</span>
          </button>

          {/* Live diagnostics — info cyan */}
          <button
            onClick={runDiagnostics}
            className={btnBase}
            style={{
              background: "rgba(0,240,255,0.08)",
              color: isDark ? "var(--color-info)" : "#0099bb",
              border: `1px solid ${isDark ? "rgba(0,240,255,0.22)" : "rgba(0,153,187,0.28)"}`,
            }}
          >
            <Stethoscope size={13} />
            <span className="hidden sm:inline">تشخيص الصوت اللحظي</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="تغيير المظهر"
            className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150"
            style={{
              background: "transparent",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border-glass)",
            }}
          >
            {isDark ? (
              // Sun — switch to light
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
            ) : (
              // Moon — switch to dark
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ════════════════════════════════════════════
          BODY — content + right icon rail
      ════════════════════════════════════════════ */}
      <div
        className="flex flex-1"
        style={{ paddingTop: "var(--topbar-h)" }}
      >
        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto p-6" style={{ marginInlineEnd: "var(--rail-w)" }}>
          <div className="casper-fade-up">
            {children}
          </div>
        </main>

        {/* ════════════════════════════════════════════
            ICON RAIL — fixed, right edge (RTL leading)
        ════════════════════════════════════════════ */}
        <nav
          className="fixed top-0 bottom-0 inset-inline-end-0 flex flex-col items-center py-3 z-40"
          style={{
            width: "var(--rail-w)",
            top: "var(--topbar-h)",
            background: "var(--color-surface-glass-rail)",
            backdropFilter: "var(--backdrop-rail)",
            WebkitBackdropFilter: "var(--backdrop-rail)",
            borderInlineStart: "1px solid var(--color-border-glass)",
          }}
          aria-label="التنقل الرئيسي"
        >
          {/* Ghost C logo mark */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-base mb-5 flex-shrink-0"
            style={{
              background: "var(--color-brand)",
              boxShadow: "0 0 16px rgba(128,82,255,0.40)",
              letterSpacing: "-1px",
              fontFamily: "var(--pr-font-primary)",
            }}
          >
            C
          </div>

          {/* Nav items */}
          <div className="flex-1 flex flex-col gap-1 w-full px-2.5 overflow-y-auto">
            {TABS.map(({ href, label, Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className="rail-item relative w-full h-11 flex items-center justify-center rounded-lg transition-all duration-200"
                  style={{
                    background: isActive ? "var(--color-brand)" : "transparent",
                    color: isActive
                      ? "#fff"
                      : "var(--color-text-muted)",
                    boxShadow: isActive
                      ? "0 4px 12px rgba(128,82,255,0.35)"
                      : "none",
                  }}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  {/* Flyout label */}
                  <span className="rail-flyout">{label}</span>
                </Link>
              );
            })}

            {/* Divider before logout */}
            <div
              className="mx-auto my-2 flex-shrink-0"
              style={{
                width: "40px",
                height: "1px",
                background: "var(--color-border-glass)",
              }}
            />

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="rail-item relative w-full h-11 flex items-center justify-center rounded-lg transition-all duration-200"
              style={{ color: "var(--color-danger)" }}
              aria-label="تسجيل الخروج"
            >
              <LogOut size={18} />
              <span className="rail-flyout" style={{ color: "var(--color-danger)" }}>
                تسجيل الخروج
              </span>
            </button>
          </div>
        </nav>
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

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  User, ShieldCheck, Building2, Key, Settings, 
  BarChart3, LogOut, ChevronDown, Moon, Sun, 
  CheckCircle2, Sparkles, Clock
} from "lucide-react";

interface UserProfileData {
  isAuthenticated: boolean;
  user: {
    name: string;
    role: string;
    roleLabel: string;
    email: string;
    initials: string;
  } | null;
  tenant: {
    id: string;
    name: string;
    phoneNumber?: string;
    state: string;
  } | null;
  session: {
    role: string;
    issuedAt: string;
    expiresAt: string | null;
  } | null;
}

interface UserProfileMenuProps {
  isDark?: boolean;
  toggleTheme?: () => void;
}

export default function UserProfileMenu({ isDark = true, toggleTheme }: UserProfileMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch session data
  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data: UserProfileData = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  // Handle outside click & Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
      window.location.href = "/login";
    }
  };

  const initials = profile?.user?.initials || "G";
  const userName = profile?.user?.name || "المدير العام";
  const userRole = profile?.user?.roleLabel || "مدير النظام الرئيسي";
  const tenantName = profile?.tenant?.name || "شركة كاسبر الرئيسية";

  return (
    <div className="relative inline-block text-right" ref={menuRef} dir="rtl">
      {/* ── Avatar Trigger Button (Matches Topbar Style) ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1 pl-2.5 pr-1 rounded-full transition-all duration-200 cursor-pointer border select-none group focus:outline-none"
        style={{
          background: isOpen ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.05)",
          borderColor: isOpen ? "rgba(6, 182, 212, 0.5)" : "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(10px)",
        }}
        aria-label="قائمة الملف الشخصي والحساب"
        aria-expanded={isOpen}
      >
        {/* Avatar Circle */}
        <div className="relative">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md transition-transform group-hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)",
              color: "#ffffff",
              boxShadow: "0 2px 10px rgba(99, 102, 241, 0.4)",
            }}
          >
            {initials}
          </div>
          {/* Online green indicator */}
          <span 
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 bg-emerald-500" 
            title="متصل الآن"
          />
        </div>

        {/* User initials / name label */}
        <span className="text-xs font-bold text-slate-200 hidden sm:inline tracking-wide group-hover:text-white transition-colors">
          {userName}
        </span>

        {/* Chevron icon */}
        <ChevronDown 
          size={14} 
          className={`text-slate-400 group-hover:text-cyan-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-cyan-400" : ""}`} 
        />
      </button>

      {/* ── Dropdown Modal Card ── */}
      {isOpen && (
        <div
          className="absolute left-0 mt-3 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden transition-all duration-200 origin-top-left border animate-in fade-in zoom-in-95"
          style={{
            background: "rgba(13, 18, 30, 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderColor: "rgba(255, 255, 255, 0.12)",
            boxShadow: "0 20px 45px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)",
          }}
        >
          {/* 1. Header Profile Banner */}
          <div 
            className="p-4 border-b relative overflow-hidden"
            style={{ 
              borderColor: "rgba(255, 255, 255, 0.08)",
              background: "linear-gradient(180deg, rgba(99, 102, 241, 0.12) 0%, transparent 100%)"
            }}
          >
            <div className="flex items-center gap-3">
              {/* Large Avatar Badge */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-xl shadow-lg border"
                style={{
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)",
                  color: "#ffffff",
                  borderColor: "rgba(255, 255, 255, 0.2)",
                  boxShadow: "0 4px 20px rgba(99, 102, 241, 0.45)",
                }}
              >
                {initials}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black text-white truncate">
                    {userName}
                  </h3>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    <ShieldCheck size={10} className="mr-0.5" />
                    Admin
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {profile?.user?.email || "admin@casper.pos"}
                </p>
                <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {userRole}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Active Tenant / Organization Context */}
          <div 
            className="p-3 mx-3 my-2.5 rounded-xl border flex flex-col gap-1.5"
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              borderColor: "rgba(255, 255, 255, 0.06)",
            }}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <Building2 size={13} className="text-cyan-400" />
                الشركة / الفرع:
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                نشط
              </span>
            </div>
            <p className="text-xs font-bold text-white truncate">
              {tenantName}
            </p>
            {profile?.tenant?.id && (
              <div className="text-[10px] text-slate-500 truncate font-mono">
                ID: {profile.tenant.id}
              </div>
            )}
          </div>

          {/* 3. Session Security Details */}
          <div className="px-4 py-2 flex items-center justify-between text-[11px] text-slate-400 border-b border-white/5">
            <span className="flex items-center gap-1">
              <Sparkles size={12} className="text-amber-400" />
              حالة الجلسة:
            </span>
            <span className="text-slate-300 font-mono text-[10px] bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
              JWT مشفرة وآمنة 🔒
            </span>
          </div>

          {/* 4. Quick Navigation Links */}
          <div className="p-2 space-y-0.5">
            <Link
              href="/dashboard/settings"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
            >
              <Settings size={15} className="text-cyan-400" />
              <span>إعدادات النظام والنشاط</span>
            </Link>

            <Link
              href="/dashboard/keys"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
            >
              <Key size={15} className="text-indigo-400" />
              <span>المفاتيح والرموز السرية</span>
            </Link>

            <Link
              href="/dashboard/reports"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
            >
              <BarChart3 size={15} className="text-emerald-400" />
              <span>تقارير المبيعات والعمليات</span>
            </Link>

            {/* Theme Toggle (if supported) */}
            {toggleTheme && (
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  {isDark ? <Moon size={15} className="text-cyan-400" /> : <Sun size={15} className="text-amber-400" />}
                  <span>المظهر {isDark ? "(الوضع الداكن)" : "(الوضع الفاتح)"}</span>
                </div>
                <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                  تبديل
                </span>
              </button>
            )}
          </div>

          {/* 5. Footer Sign Out */}
          <div 
            className="p-2 border-t"
            style={{ 
              borderColor: "rgba(255, 255, 255, 0.08)",
              background: "rgba(0, 0, 0, 0.2)"
            }}
          >
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:text-white hover:bg-red-500/20 transition-all cursor-pointer border border-red-500/20 hover:border-red-500/40"
            >
              <LogOut size={14} />
              <span>تسجيل الخروج من الحساب</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, User, Lock, Phone, ArrowLeft, 
  Sparkles, Loader2, AlertCircle, Building2, CheckCircle2 
} from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState<"admin" | "customer">("admin");
  
  // Admin form
  const [adminPassword, setAdminPassword] = useState("");
  
  // Customer form
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!adminPassword.trim()) {
      setError("يرجى إدخال كلمة المرور");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push("/dashboard/reports");
      } else {
        setError(data.error || "كلمة المرور غير صحيحة");
      }
    } catch (err: any) {
      setError(err?.message || "تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!customerPhone.trim() || customerPhone.trim().length < 8) {
      setError("يرجى إدخال رقم هاتف صحيح (8 أرقام على الأقل)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: customerPhone,
          name: customerName,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push("/customer/dashboard");
      } else {
        setError(data.error || "فشل تسجيل دخول العميل");
      }
    } catch (err: any) {
      setError(err?.message || "تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden selection:bg-cyan-500/30"
      style={{ background: "#050508", color: "#e4e4e7" }}
      dir="rtl"
    >
      {/* ── Ambient Background Glow Spheres ── */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* ── Brand Logo & Header ── */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900/80 border border-white/10 shadow-2xl backdrop-blur-xl mb-2 relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 rounded-2xl blur-sm group-hover:blur-md transition-all" />
            <Sparkles className="w-7 h-7 text-cyan-400 relative z-10" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            كاسبر <span className="text-transparent bg-clip-text bg-gradient-to-l from-cyan-400 to-emerald-400">POS & ERP</span>
          </h1>
          <p className="text-xs text-zinc-400 font-bold">بوابة تسجيل الدخول الموحدة للأنظمة السحابية</p>
        </div>

        {/* ── Login Card ── */}
        <div className="bg-zinc-900/40 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6 relative overflow-hidden">
          
          {/* Subtle top border highlight */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

          {/* ── Persona Switcher Tabs ── */}
          <div className="bg-zinc-950/80 p-1.5 rounded-2xl border border-white/5 flex gap-1 shadow-inner">
            <button
              type="button"
              onClick={() => { setMode("admin"); setError(""); }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                mode === "admin"
                  ? "bg-cyan-500 text-zinc-950 shadow-lg shadow-cyan-500/25"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              لوحة الإدارة
            </button>
            <button
              type="button"
              onClick={() => { setMode("customer"); setError(""); }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                mode === "customer"
                  ? "bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/25"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <User className="w-4 h-4" />
              بوابة العميل
            </button>
          </div>

          {/* ── Error Banner ── */}
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Admin Login Form ── */}
          {mode === "admin" && (
            <form onSubmit={handleAdminSubmit} className="space-y-4 animate-in fade-in duration-300">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-zinc-300">كلمة المرور الرئيسية</label>
                <div className="relative">
                  <Lock className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    autoFocus
                    className="w-full h-12 ps-11 pe-4 bg-zinc-950/80 border border-white/10 text-white placeholder:text-zinc-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 rounded-2xl font-mono text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] text-zinc-950 font-black rounded-2xl text-sm transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-2 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>تسجيل الدخول للوحة التحكم</span>
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── Customer Login Form ── */}
          {mode === "customer" && (
            <form onSubmit={handleCustomerSubmit} className="space-y-4 animate-in fade-in duration-300">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-zinc-300">رقم الهاتف المسجل *</label>
                <div className="relative">
                  <Phone className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="tel"
                    placeholder="010XXXXXXXX"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    autoFocus
                    className="w-full h-12 ps-11 pe-4 bg-zinc-950/80 border border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl font-mono text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-400">الاسم (اختياري للعملاء الجدد)</label>
                <div className="relative">
                  <User className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="أدخل اسمك"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full h-12 ps-11 pe-4 bg-zinc-950/80 border border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl text-sm font-bold outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-zinc-950 font-black rounded-2xl text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-2 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>دخول بوابة العميل</span>
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── Feature Highlights ── */}
          <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px] text-zinc-400 font-bold">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>مزامنة سحابية فورية</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>تقارير وفواتير دقيقة</span>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-[11px] text-zinc-500 font-medium">
          Casper Voice & POS ERP Platform © 2026. All rights reserved.
        </p>
      </div>
    </div>
  );
}

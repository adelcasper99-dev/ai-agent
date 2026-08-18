// app/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, User, Lock, Phone, ArrowLeft, 
  Sparkles, Loader2, AlertCircle, CheckCircle2,
  KeyRound, ArrowRight, UserCheck
} from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState<"admin" | "customer">("customer");
  
  // Admin form state
  const [adminPassword, setAdminPassword] = useState("");
  
  // Customer multi-step state: "phone" | "enter_pin" | "setup_pin"
  const [customerStep, setCustomerStep] = useState<"phone" | "enter_pin" | "setup_pin">("phone");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPin, setCustomerPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "admin") {
        setMode("admin");
      }
    }
  }, []);

  // ── Admin Login Handler ──
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

  // ── Step 1: Customer Phone Check ──
  const handleCustomerPhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleanedPhone = customerPhone.trim();
    if (!cleanedPhone || cleanedPhone.length < 8) {
      setError("يرجى إدخال رقم هاتف صحيح (8 أرقام على الأقل)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanedPhone,
          checkOnly: true,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.exists && data.hasPin) {
          setCustomerName(data.customerName || "");
          setCustomerStep("enter_pin");
        } else {
          setCustomerName(data.customerName || "");
          setCustomerStep("setup_pin");
        }
      } else {
        setError(data.error || "فشل التحقق من رقم الهاتف");
      }
    } catch (err: any) {
      setError(err?.message || "تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2a: Customer PIN Login ──
  const handleCustomerPinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!customerPin.trim()) {
      setError("يرجى إدخال الرمز السري");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: customerPhone,
          pin: customerPin,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push("/customer/dashboard");
      } else {
        if (data.requiresSetup) {
          setCustomerStep("setup_pin");
          setError("يرجى تعيين رمز سري لحسابك أولاً");
        } else {
          setError(data.error || "الرمز السري غير صحيح");
        }
      }
    } catch (err: any) {
      setError(err?.message || "تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2b: Customer Onboarding & PIN Setup ──
  const handleCustomerOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!customerName.trim()) {
      setError("يرجى إدخال اسمك الكريم");
      return;
    }
    if (customerPin.length < 4 || customerPin.length > 8) {
      setError("الرمز السري يجب أن يكون بين 4 إلى 8 أرقام");
      return;
    }
    if (customerPin !== confirmPin) {
      setError("الرمز السري وتأكيد الرمز غير متطابقين");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: customerPhone,
          name: customerName,
          pin: customerPin,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push("/customer/dashboard");
      } else {
        setError(data.error || "فشل تهيئة الحساب");
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
              onClick={() => { setMode("customer"); setError(""); setCustomerStep("phone"); }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                mode === "customer"
                  ? "bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/25"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <User className="w-4 h-4" />
              بوابة العميل
            </button>
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

          {/* ── Customer Portal State Machine ── */}
          {mode === "customer" && (
            <div className="space-y-4 animate-in fade-in duration-300">
              
              {/* ── Step 1: Enter Phone Number ── */}
              {customerStep === "phone" && (
                <form onSubmit={handleCustomerPhoneSubmit} className="space-y-4">
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

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-zinc-950 font-black rounded-2xl text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>متابعة</span>
                        <ArrowLeft className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* ── Step 2a: Enter PIN for Existing Customer ── */}
              {customerStep === "enter_pin" && (
                <form onSubmit={handleCustomerPinLogin} className="space-y-4">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-white">{customerName || "عميل كاسبر"}</p>
                      <p className="text-[11px] text-zinc-400 font-mono">{customerPhone}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCustomerStep("phone"); setError(""); setCustomerPin(""); }}
                      className="text-[10px] text-emerald-400 hover:underline font-bold"
                    >
                      تغيير الرقم
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-zinc-300">أدخل الرمز السري (PIN) *</label>
                    <div className="relative">
                      <KeyRound className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="password"
                        placeholder="••••"
                        maxLength={8}
                        value={customerPin}
                        onChange={(e) => setCustomerPin(e.target.value)}
                        autoFocus
                        className="w-full h-12 ps-11 pe-4 bg-zinc-950/80 border border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl font-mono text-center tracking-widest text-lg outline-none transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-zinc-950 font-black rounded-2xl text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>تسجيل الدخول</span>
                        <ArrowLeft className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* ── Step 2b: Onboarding & PIN Setup ── */}
              {customerStep === "setup_pin" && (
                <form onSubmit={handleCustomerOnboardingSubmit} className="space-y-3.5">
                  <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-cyan-400" />
                      <div>
                        <p className="text-xs font-black text-white">تهيئة الحساب لأول مرة</p>
                        <p className="text-[10px] text-zinc-400 font-mono">{customerPhone}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCustomerStep("phone"); setError(""); setCustomerPin(""); }}
                      className="text-[10px] text-cyan-400 hover:underline font-bold"
                    >
                      تغيير
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-black text-zinc-300">الاسم الكامل *</label>
                    <input
                      type="text"
                      placeholder="أدخل اسمك الكريم"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                      className="w-full h-11 px-4 bg-zinc-950/80 border border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-xs font-bold outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-black text-zinc-300">الرمز السري (PIN) *</label>
                      <input
                        type="password"
                        placeholder="••••"
                        maxLength={8}
                        value={customerPin}
                        onChange={(e) => setCustomerPin(e.target.value)}
                        required
                        className="w-full h-11 px-3 bg-zinc-950/80 border border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 rounded-xl font-mono text-center tracking-wider text-sm outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-black text-zinc-300">تأكيد الرمز *</label>
                      <input
                        type="password"
                        placeholder="••••"
                        maxLength={8}
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value)}
                        required
                        className="w-full h-11 px-3 bg-zinc-950/80 border border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 rounded-xl font-mono text-center tracking-wider text-sm outline-none transition-all"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-500">اختر رمزاً سهلاً من 4 إلى 8 أرقام لتسجيل دخولك لاحقاً.</p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-gradient-to-l from-emerald-500 to-cyan-500 hover:opacity-90 active:scale-[0.99] text-zinc-950 font-black rounded-2xl text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-1"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>تفعيل الحساب والدخول</span>
                        <ArrowLeft className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

            </div>
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

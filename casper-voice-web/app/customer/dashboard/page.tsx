// app/customer/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { 
  User, Phone, LogOut, Calendar, ShoppingBag, 
  DollarSign, FileText, CheckCircle2, Clock, 
  ArrowUpRight, ArrowDownLeft, ShieldCheck, Sparkles,
  AlertCircle, ChevronRight, Receipt, RefreshCw
} from "lucide-react";

export default function CustomerDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"appointments" | "sales" | "ledger">("appointments");
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadCustomerData = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/customer/data");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const json = await res.json();
      if (res.ok) {
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load customer data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCustomerData();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: "#050508", color: "#e4e4e7" }}
        dir="rtl"
      >
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-sm font-black text-zinc-400">جاري تحميل بيانات حسابك...</p>
        </div>
      </div>
    );
  }

  const customer = data?.customer || {};
  const stats = data?.stats || {};
  const appointments = data?.appointments || [];
  const sales = data?.sales || [];
  const ledgers = data?.ledgers || [];

  const debt = new Decimal(stats.outstandingBalance || 0);
  const hasDebt = debt.greaterThan(0);

  return (
    <div 
      className="min-h-screen p-4 sm:p-8"
      style={{ background: "#050508", color: "#e4e4e7" }}
      dir="rtl"
    >
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* ── Top Navigation Bar ── */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/40 p-4 sm:p-6 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center shadow-lg">
              <User className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-white">{customer.name || "العميل الكريم"}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  عميل معتمد
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5 flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-zinc-500" /> {customer.phone || "غير محدد"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={loadCustomerData}
              disabled={refreshing}
              className="p-2.5 bg-zinc-900 border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white rounded-2xl transition-all cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-400" : ""}`} />
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-500/10"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </header>

        {/* ── Financial & Overview Bento Cards ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Total Purchases */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 backdrop-blur-xl relative overflow-hidden group hover:border-white/10 transition-all shadow-xl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex justify-between items-start mb-3">
              <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                <ShoppingBag className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-[10px] font-bold text-zinc-400 bg-white/5 px-2 py-1 rounded-lg">إجمالي</span>
            </div>
            <p className="text-2xl font-black text-white font-mono">{stats.totalPurchases || "0.00"} <span className="text-xs font-sans text-zinc-400 font-bold">ج.م</span></p>
            <p className="text-xs text-zinc-400 font-bold mt-1">إجمالي المشتريات</p>
          </div>

          {/* Total Payments */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 backdrop-blur-xl relative overflow-hidden group hover:border-white/10 transition-all shadow-xl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex justify-between items-start mb-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">مدفوع</span>
            </div>
            <p className="text-2xl font-black text-emerald-400 font-mono">{stats.totalCredit || "0.00"} <span className="text-xs font-sans text-zinc-400 font-bold">ج.م</span></p>
            <p className="text-xs text-zinc-400 font-bold mt-1">إجمالي المسدد</p>
          </div>

          {/* Outstanding Balance */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 backdrop-blur-xl relative overflow-hidden group hover:border-white/10 transition-all shadow-xl">
            <div className={`absolute top-0 right-0 w-24 h-24 ${hasDebt ? "bg-rose-500/10" : "bg-emerald-500/10"} rounded-full blur-2xl pointer-events-none`} />
            <div className="flex justify-between items-start mb-3">
              <div className={`p-2.5 rounded-2xl ${hasDebt ? "bg-rose-500/10 border border-rose-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}`}>
                <FileText className={`w-5 h-5 ${hasDebt ? "text-rose-400" : "text-emerald-400"}`} />
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${hasDebt ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                {hasDebt ? "مستحق" : "خالص"}
              </span>
            </div>
            <p className={`text-2xl font-black font-mono ${hasDebt ? "text-rose-400" : "text-emerald-400"}`}>
              {stats.outstandingBalance || "0.00"} <span className="text-xs font-sans text-zinc-400 font-bold">ج.م</span>
            </p>
            <p className="text-xs text-zinc-400 font-bold mt-1">الرصيد المتبقي (الآجل)</p>
          </div>

          {/* Appointments Count */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 backdrop-blur-xl relative overflow-hidden group hover:border-white/10 transition-all shadow-xl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex justify-between items-start mb-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <Calendar className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">المواعيد</span>
            </div>
            <p className="text-2xl font-black text-white font-mono">{stats.appointmentsCount || 0} <span className="text-xs font-sans text-zinc-400 font-bold">حجز</span></p>
            <p className="text-xs text-zinc-400 font-bold mt-1">سجل المواعيد</p>
          </div>

        </section>

        {/* ── Navigation Tabs ── */}
        <div className="bg-zinc-900/50 p-1.5 rounded-2xl border border-white/10 inline-flex flex-wrap gap-1 shadow-inner">
          <button
            onClick={() => setActiveTab("appointments")}
            className={`py-2.5 px-5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "appointments"
                ? "bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>المواعيد والحجوزات ({appointments.length})</span>
          </button>
          
          <button
            onClick={() => setActiveTab("sales")}
            className={`py-2.5 px-5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "sales"
                ? "bg-cyan-500 text-zinc-950 shadow-lg shadow-cyan-500/20"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>سجل الفواتير والمشتريات ({sales.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("ledger")}
            className={`py-2.5 px-5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "ledger"
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>كشف الحساب والمدفوعات ({ledgers.length})</span>
          </button>
        </div>

        {/* ── Tab Content 1: Appointments ── */}
        {activeTab === "appointments" && (
          <div className="bg-zinc-900/40 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl animate-in fade-in duration-300">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                سجل المواعيد والحجوزات الخاصة بك
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 border-b border-white/10 text-zinc-400">
                  <tr>
                    <th className="text-right py-4 px-6 text-xs font-black">التاريخ</th>
                    <th className="text-center py-4 px-6 text-xs font-black">الوقت</th>
                    <th className="text-center py-4 px-6 text-xs font-black">الخدمة / الملاحظات</th>
                    <th className="text-left py-4 px-6 text-xs font-black">حالة الحجز</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                  {appointments.map((a: any, i: number) => (
                    <tr key={a.id || i} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6 font-bold text-white font-mono text-xs">{a.date}</td>
                      <td className="py-4 px-6 text-center font-mono text-zinc-400 text-xs">{a.time || "غير محدد"}</td>
                      <td className="py-4 px-6 text-center font-medium text-xs text-zinc-300">{a.notes || a.service || "حجز عام"}</td>
                      <td className="py-4 px-6 text-left">
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                          {a.status || "مؤكد"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {appointments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-zinc-500 font-bold text-xs">
                        لا توجد مواعيد مسجلة حالياً
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tab Content 2: Sales & Purchases ── */}
        {activeTab === "sales" && (
          <div className="bg-zinc-900/40 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl animate-in fade-in duration-300">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-cyan-400" />
                سجل الفواتير والمشتريات
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 border-b border-white/10 text-zinc-400">
                  <tr>
                    <th className="text-right py-4 px-6 text-xs font-black">الصنف / البيان</th>
                    <th className="text-center py-4 px-6 text-xs font-black">الكمية</th>
                    <th className="text-center py-4 px-6 text-xs font-black">المبلغ الإجمالي</th>
                    <th className="text-left py-4 px-6 text-xs font-black">تاريخ الفاتورة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                  {sales.map((s: any, i: number) => (
                    <tr key={s.id || i} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6 font-bold text-white text-xs">{s.itemName || "فاتورة مبيعات"}</td>
                      <td className="py-4 px-6 text-center font-mono font-bold text-xs text-zinc-400">{s.quantity || 1}</td>
                      <td className="py-4 px-6 text-center font-mono font-black text-cyan-400 text-sm">
                        {new Decimal(s.total || 0).toFixed(2)} ج.م
                      </td>
                      <td className="py-4 px-6 text-left font-mono text-zinc-500 text-xs">
                        {new Date(s.createdAt).toLocaleDateString("ar-EG")}
                      </td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-zinc-500 font-bold text-xs">
                        لا توجد فواتير مسجلة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tab Content 3: Account Ledger & Statements ── */}
        {activeTab === "ledger" && (
          <div className="bg-zinc-900/40 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl animate-in fade-in duration-300">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                كشف الحساب والعمليات المالية
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 border-b border-white/10 text-zinc-400">
                  <tr>
                    <th className="text-right py-4 px-6 text-xs font-black">نوع الحركة</th>
                    <th className="text-center py-4 px-6 text-xs font-black">الوصف</th>
                    <th className="text-center py-4 px-6 text-xs font-black">المبلغ</th>
                    <th className="text-left py-4 px-6 text-xs font-black">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                  {ledgers.map((l: any, i: number) => {
                    const isDebit = l.entryType === "SALE_DEBIT";
                    return (
                      <tr key={l.id || i} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 font-bold text-xs flex items-center gap-2">
                          {isDebit ? (
                            <span className="p-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                              <ArrowUpRight className="w-3 h-3" /> فاتورة / مدين
                            </span>
                          ) : (
                            <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <ArrowDownLeft className="w-3 h-3" /> دفعة مسددة / دائن
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center text-xs text-zinc-300 font-medium">{l.description || "-"}</td>
                        <td className={`py-4 px-6 text-center font-mono font-black text-sm ${isDebit ? "text-rose-400" : "text-emerald-400"}`}>
                          {new Decimal(l.amount || 0).toFixed(2)} ج.م
                        </td>
                        <td className="py-4 px-6 text-left font-mono text-zinc-500 text-xs">
                          {new Date(l.createdAt).toLocaleDateString("ar-EG")}
                        </td>
                      </tr>
                    );
                  })}
                  {ledgers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-zinc-500 font-bold text-xs">
                        لا توجد حركات مالية مسجلة في كشف الحساب
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

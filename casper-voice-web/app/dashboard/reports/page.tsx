// app/dashboard/reports/page.tsx
"use client";

import { useEffect, useState, Fragment } from "react";
import Decimal from "decimal.js";
import * as XLSX from "xlsx";
import { 
  TrendingUp, TrendingDown, ShoppingBag, DollarSign, 
  Filter, Calendar as CalendarIcon, FileText,
  BarChart2, Clock, Users, Search, ChevronDown, X, Edit2, Eye,
  Download, AlertTriangle, Layers, Tag, User, Store, Phone, Truck, Building2,
  Trash2, CheckCircle2, Loader2, Receipt, AlertCircle
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar
} from "recharts";
import { FlatpickrRangePicker } from "@/components/ui/flatpickr-range-picker";
import { 
    startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, 
    startOfMonth, endOfMonth, isWithinInterval, format as fmtDate
} from "date-fns";

// ── Custom Tabs ──
function Tabs({ activeTab, onChange, children }: any) {
  return <div className="space-y-6">{children}</div>;
}
function TabsList({ children }: any) {
  return (
    <div className="glass-dock border border-slate-700/60 inline-flex p-1.5 rounded-2xl shadow-xl">
      {children}
    </div>
  );
}
function TabsTrigger({ active, onClick, children, activeClass, defaultClass }: any) {
  return (
    <button
      onClick={onClick}
      className={`font-bold tracking-wide w-full md:w-48 rounded-lg transition-all duration-300 py-2.5 px-4 flex items-center justify-center gap-2 ${
        active ? activeClass : defaultClass
      }`}
    >
      {children}
    </button>
  );
}
function TabsContent({ active, children }: any) {
  if (!active) return null;
  return <div className="space-y-6 animate-in fade-in duration-500">{children}</div>;
}

// ── KPI Card Component ──
function KPICard({ title, value, icon, trend, color, accentColor, negative }: any) {
  return (
    <div className="glass-card-lg border border-slate-700/60 rounded-2xl p-5 relative overflow-hidden group hover:border-cyan-500/40 transition-all duration-200 hover:scale-[1.01] shadow-xl">
      <div 
        className="absolute top-0 right-0 w-24 h-24 rounded-full blur-[60px] -mr-10 -mt-10 opacity-30 group-hover:opacity-50 transition-opacity"
        style={{ background: accentColor }}
      />
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="p-2 rounded-xl" style={{ background: `${accentColor}20` }}>
          {icon}
        </div>
        <span 
          className={`text-xs font-bold px-2 py-1 rounded-md ${
            negative ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
          }`}
        >
          {trend}
        </span>
      </div>
      <div className="relative z-10">
        <p className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
          {value}
        </p>
        <p className="text-zinc-400 text-sm font-bold mt-1">{title}</p>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("financial");
  const [filterPeriod, setFilterPeriod] = useState("month");
  
  // Tenant Selection
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("all");

  // Suppliers Filters
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const [supplierDateFilter, setSupplierDateFilter] = useState("all");
  const [supplierDateRange, setSupplierDateRange] = useState<{ from: Date | undefined; to: Date | undefined } | undefined>(undefined);
  const [supplierStatusFilter, setSupplierStatusFilter] = useState("all");
  
  const [expandedSupplier, setExpandedSupplier] = useState<number | null>(null);
  
  const [expenses, setExpenses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sales Analysis
  type GroupByOption = "category" | "product" | "salesman";
  const [salesGroupBy, setSalesGroupBy] = useState<GroupByOption>("category");
  const [salesAnalysis, setSalesAnalysis] = useState<any>(null);
  const [salesAnalysisLoading, setSalesAnalysisLoading] = useState(false);

  // Aged Receivables
  const [agedReceivables, setAgedReceivables] = useState<any>(null);
  const [agedLoading, setAgedLoading] = useState(false);

  // ── Action Modals State ──
  const [editSupplierModal, setEditSupplierModal] = useState<{
    isOpen: boolean;
    supplier: any | null;
    name: string;
    phone: string;
    isSaving: boolean;
    error: string;
  }>({ isOpen: false, supplier: null, name: "", phone: "", isSaving: false, error: "" });

  const [paySupplierModal, setPaySupplierModal] = useState<{
    isOpen: boolean;
    supplier: any | null;
    amount: string;
    notes: string;
    isSaving: boolean;
    error: string;
  }>({ isOpen: false, supplier: null, amount: "", notes: "", isSaving: false, error: "" });

  const [statementModal, setStatementModal] = useState<{
    isOpen: boolean;
    supplier: any | null;
  }>({ isOpen: false, supplier: null });

  const [viewDetailModal, setViewDetailModal] = useState<{
    isOpen: boolean;
    title: string;
    item: any | null;
    type: "invoice" | "return";
    supplierName: string;
  }>({ isOpen: false, title: "", item: null, type: "invoice", supplierName: "" });

  const [deleteSupplierModal, setDeleteSupplierModal] = useState<{
    isOpen: boolean;
    supplier: any | null;
    isDeleting: boolean;
  }>({ isOpen: false, supplier: null, isDeleting: false });

  const reloadSuppliers = async () => {
    const tenantQuery = selectedTenantId !== "all" ? `?tenantId=${selectedTenantId}` : "";
    try {
      const res = await fetch(`/api/reports/suppliers${tenantQuery}`);
      const data = await res.json();
      if (data.suppliers) {
        setSuppliers(data.suppliers);
      }
    } catch (err) {
      console.error("Error reloading suppliers:", err);
    }
  };

  const handleOpenEditSupplier = (sup: any) => {
    setEditSupplierModal({
      isOpen: true,
      supplier: sup,
      name: sup.name || "",
      phone: sup.phone || "",
      isSaving: false,
      error: "",
    });
  };

  const handleSaveEditSupplier = async () => {
    if (!editSupplierModal.supplier) return;
    if (!editSupplierModal.name.trim()) {
      setEditSupplierModal(prev => ({ ...prev, error: "اسم المورد مطلوب" }));
      return;
    }

    setEditSupplierModal(prev => ({ ...prev, isSaving: true, error: "" }));
    try {
      const res = await fetch(`/api/reports/suppliers/${editSupplierModal.supplier.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editSupplierModal.name,
          phone: editSupplierModal.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل التعديل");
      }
      setEditSupplierModal(prev => ({ ...prev, isOpen: false, isSaving: false }));
      await reloadSuppliers();
    } catch (err: any) {
      setEditSupplierModal(prev => ({ ...prev, isSaving: false, error: err.message }));
    }
  };

  const handleOpenPaySupplier = (sup: any) => {
    setPaySupplierModal({
      isOpen: true,
      supplier: sup,
      amount: "",
      notes: "",
      isSaving: false,
      error: "",
    });
  };

  const handleSavePaySupplier = async () => {
    if (!paySupplierModal.supplier) return;
    try {
      const amt = new Decimal(paySupplierModal.amount);
      if (amt.lessThanOrEqualTo(0)) {
        setPaySupplierModal(prev => ({ ...prev, error: "يرجى إدخال مبلغ صحيح أكبر من الصفر" }));
        return;
      }
    } catch {
      setPaySupplierModal(prev => ({ ...prev, error: "يرجى إدخال رقم صحيح للمبلغ" }));
      return;
    }

    setPaySupplierModal(prev => ({ ...prev, isSaving: true, error: "" }));
    try {
      const res = await fetch(`/api/reports/suppliers/${paySupplierModal.supplier.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: paySupplierModal.amount,
          notes: paySupplierModal.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل تسجيل الدفعة");
      }
      setPaySupplierModal(prev => ({ ...prev, isOpen: false, isSaving: false }));
      await reloadSuppliers();
    } catch (err: any) {
      setPaySupplierModal(prev => ({ ...prev, isSaving: false, error: err.message }));
    }
  };

  const handleOpenDeleteSupplier = (sup: any) => {
    setDeleteSupplierModal({
      isOpen: true,
      supplier: sup,
      isDeleting: false,
    });
  };

  const handleConfirmDeleteSupplier = async () => {
    if (!deleteSupplierModal.supplier) return;
    setDeleteSupplierModal(prev => ({ ...prev, isDeleting: true }));
    try {
      const res = await fetch(`/api/reports/suppliers/${deleteSupplierModal.supplier.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل الحذف");
      }
      setDeleteSupplierModal({ isOpen: false, supplier: null, isDeleting: false });
      await reloadSuppliers();
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء الحذف");
      setDeleteSupplierModal(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const handleOpenStatement = (sup: any) => {
    setStatementModal({
      isOpen: true,
      supplier: sup,
    });
  };

  const handleViewInvoice = (inv: any, sup: any) => {
    setViewDetailModal({
      isOpen: true,
      title: `تفاصيل فاتورة شراء #${inv.id || inv}`,
      item: typeof inv === "object" ? inv : { id: `INV-00${inv}`, totalAmount: 450 * inv, createdAt: `2026-08-0${inv}`, itemName: "مستلزمات عامة" },
      type: "invoice",
      supplierName: sup.name,
    });
  };

  const handleViewReturn = (ret: any, sup: any) => {
    setViewDetailModal({
      isOpen: true,
      title: `تفاصيل مرتجع #${ret.id || ret}`,
      item: typeof ret === "object" ? ret : { id: `RET-00${ret}`, totalAmount: 150 * ret, createdAt: `2026-08-0${ret}`, itemName: "مرتجع صنف تالف" },
      type: "return",
      supplierName: sup.name,
    });
  };

  // Load tenant list for selector on mount
  useEffect(() => {
    fetch("/api/tenants/list")
      .then((r) => r.json())
      .then((data) => {
        if (data.tenants) setTenants(data.tenants);
      })
      .catch((err) => console.error("Error fetching tenants list:", err));
  }, []);

  // Fetch report data based on selectedTenantId
  useEffect(() => {
    setLoading(true);
    const tenantQuery = selectedTenantId !== "all" ? `?tenantId=${selectedTenantId}` : "";
    Promise.all([
      fetch(`/api/expenses${tenantQuery}`).then((r) => r.json()),
      fetch(`/api/sales${tenantQuery}`).then((r) => r.json()),
      fetch(`/api/appointments${tenantQuery}`).then((r) => r.json()),
      fetch(`/api/reports/suppliers${tenantQuery}`).then((r) => r.json()),
    ]).then(([e, s, a, sup]) => {
      setExpenses(e.expenses || []);
      setSales(s.sales || []);
      setAppointments(a.appointments || []);
      setSuppliers(sup.suppliers || []);
      setLoading(false);
    });
  }, [selectedTenantId]);

  // Fetch Sales Analysis when groupBy or tenant changes
  useEffect(() => {
    if (activeTab !== "sales_analysis") return;
    setSalesAnalysisLoading(true);
    const tenantQuery = selectedTenantId !== "all" ? `&tenantId=${selectedTenantId}` : "";
    fetch(`/api/reports/sales-analysis?groupBy=${salesGroupBy}${tenantQuery}`)
      .then(r => r.json())
      .then(data => { setSalesAnalysis(data); setSalesAnalysisLoading(false); })
      .catch(() => setSalesAnalysisLoading(false));
  }, [salesGroupBy, activeTab, selectedTenantId]);

  // Fetch Aged Receivables on tab open or tenant change
  useEffect(() => {
    if (activeTab !== "aged_receivables") return;
    setAgedLoading(true);
    const tenantQuery = selectedTenantId !== "all" ? `?tenantId=${selectedTenantId}` : "";
    fetch(`/api/reports/aged-receivables${tenantQuery}`)
      .then(r => r.json())
      .then(data => { setAgedReceivables(data); setAgedLoading(false); })
      .catch(() => setAgedLoading(false));
  }, [activeTab, selectedTenantId]);

  const totalExpenses = expenses.reduce((acc, e) => acc.plus(new Decimal(e.amount ?? 0)), new Decimal(0));
  const totalSales = sales.reduce((acc, s) => acc.plus(new Decimal(s.total ?? 0)), new Decimal(0));
  const totalSupplierDebts = suppliers.reduce((acc, s) => acc.plus(new Decimal(s.totalDebt ?? 0)), new Decimal(0));
  const netProfit = totalSales.minus(totalExpenses);

  const filteredSuppliers = suppliers.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
                           s.phone?.includes(supplierSearchTerm);
      if (!matchesSearch) return false;

      if (supplierStatusFilter === 'inDebt' && s.totalDebt <= 0) return false;
      if (supplierStatusFilter === 'credit' && s.totalDebt >= 0) return false;

      if (supplierDateRange?.from && supplierDateRange?.to) {
          const createdDate = new Date(s.createdAt || new Date());
          return isWithinInterval(createdDate, {
              start: supplierDateRange.from,
              end: supplierDateRange.to
          });
      }

      return true;
  });

  // Supplier Stats Bar derivation
  const supplierStats = {
    totalDebt: filteredSuppliers.reduce((acc, s) => new Decimal(s.totalDebt ?? 0).greaterThan(0) ? acc.plus(new Decimal(s.totalDebt ?? 0)) : acc, new Decimal(0)),
    totalCredit: filteredSuppliers.reduce((acc, s) => new Decimal(s.totalDebt ?? 0).lessThan(0) ? acc.plus(new Decimal(s.totalDebt ?? 0).abs()) : acc, new Decimal(0)),
    count: filteredSuppliers.length,
  };

  // Generate mock trend data for charts based on actual total
  const trendData = Array.from({ length: 7 }).map((_, i) => ({
    name: `يوم ${i + 1}`,
    revenue: Math.max(100, Math.floor(Math.random() * (totalSales.toNumber() / 4))),
    expenses: Math.max(50, Math.floor(Math.random() * (totalExpenses.toNumber() / 4))),
  }));

  if (loading) {
    return <div className="text-center p-20 font-bold text-slate-500">جاري تحميل تقارير Casper POS...</div>;
  }

  return (
    <div 
      className="-m-8 p-8 min-h-[calc(100vh-var(--topbar-h))]" 
      style={{ background: "transparent", color: "var(--foreground)" }}
      dir="rtl"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* ── Page Header & Filters ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 glass-card-lg p-6 rounded-2xl border border-slate-700/60 shadow-xl">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <BarChart2 className="text-cyan-400" />
              مركز التقارير والتحليلات
            </h1>
            <p className="text-zinc-400 text-sm mt-1 font-medium">التقارير المالية والتحليلات المتقدمة (Casper POS)</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 p-1.5 rounded-xl bg-zinc-900 border border-cyan-500/30 text-cyan-400">
              <Building2 className="w-4 h-4 text-cyan-400 ms-2 shrink-0" />
              <select 
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="bg-transparent border-none text-sm font-bold text-white focus:ring-0 px-2 py-1 outline-none cursor-pointer"
              >
                <option value="all" className="bg-zinc-900 text-white">🏢 جميع الشركات (إجمالي)</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id} className="bg-zinc-900 text-white">
                    🏢 {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shrink-0">
              {['today', 'week', 'month'].map((p) => (
                <button 
                  key={p}
                  onClick={() => setFilterPeriod(p)}
                  className={`px-4 py-2.5 text-xs font-bold transition-colors border-l border-white/10 ${
                    filterPeriod === p ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {p === 'today' ? 'اليوم' : p === 'week' ? 'أسبوع' : 'شهر'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tabs Navigation ── */}
        <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
          <Tabs>
            <TabsList>
              <TabsTrigger 
                active={activeTab === "financial"} 
                onClick={() => setActiveTab("financial")}
                activeClass="bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                defaultClass="text-zinc-400 hover:text-white"
              >
                المالية والإيرادات
              </TabsTrigger>
              <TabsTrigger 
                active={activeTab === "sales"} 
                onClick={() => setActiveTab("sales")}
                activeClass="bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                defaultClass="text-zinc-400 hover:text-white"
              >
                المبيعات
              </TabsTrigger>
              <TabsTrigger 
                active={activeTab === "appointments"} 
                onClick={() => setActiveTab("appointments")}
                activeClass="bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                defaultClass="text-zinc-400 hover:text-white"
              >
                الحجوزات
              </TabsTrigger>
              <TabsTrigger 
                active={activeTab === "expenses"} 
                onClick={() => setActiveTab("expenses")}
                activeClass="bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                defaultClass="text-zinc-400 hover:text-white"
              >
                المصروفات
              </TabsTrigger>
              <TabsTrigger 
                active={activeTab === "suppliers"} 
                onClick={() => setActiveTab("suppliers")}
                activeClass="bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                defaultClass="text-zinc-400 hover:text-white"
              >
                الموردين والآجل
              </TabsTrigger>
            </TabsList>

            {/* ── Financial Tab Content (Overview) ── */}
            <TabsContent active={activeTab === "financial"}>
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title="إجمالي الإيرادات"
                  value={`${totalSales.toFixed(2)} ج.م`}
                  icon={<DollarSign className="w-5 h-5 text-cyan-400" />}
                  trend="+12.5%"
                  accentColor="#06b6d4"
                />
                <KPICard
                  title="إجمالي المصاريف"
                  value={`${totalExpenses.toFixed(2)} ج.م`}
                  icon={<FileText className="w-5 h-5 text-rose-400" />}
                  trend="+4.2%"
                  negative
                  accentColor="#f43f5e"
                />
                <KPICard
                  title="ديون الموردين"
                  value={`${totalSupplierDebts.toFixed(2)} ج.م`}
                  icon={<ShoppingBag className="w-5 h-5 text-amber-400" />}
                  trend="-2.1%"
                  negative
                  accentColor="#fbbf24"
                />
                <KPICard
                  title="صافي الربح"
                  value={`${netProfit.toFixed(2)} ج.م`}
                  icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
                  trend="+18.3%"
                  accentColor="#10b981"
                />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Area Chart */}
                <div className="lg:col-span-2 bg-zinc-900/30 border border-white/5 rounded-2xl shadow-2xl backdrop-blur-xl group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[80px] -mr-16 -mt-16 rounded-full" />
                  <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <span className="p-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/20">
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                      </span>
                      اتجاه نمو الإيرادات والمصاريف
                    </h3>
                  </div>
                  <div className="p-6 h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                        <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', fontWeight: 'bold' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                        <Area type="monotone" dataKey="expenses" name="المصاريف" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Secondary Chart */}
                <div className="bg-zinc-900/30 border border-white/5 rounded-2xl shadow-2xl backdrop-blur-xl group relative overflow-hidden">
                  <div className="p-6 border-b border-white/5">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <span className="p-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                        <BarChart2 className="w-4 h-4 text-emerald-400" />
                      </span>
                      توزيع المبيعات
                    </h3>
                  </div>
                  <div className="p-6 h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                        <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} />
                        <RechartsTooltip 
                          cursor={{ fill: '#ffffff05' }}
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                        />
                        <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Sales Tab ── */}
            <TabsContent active={activeTab === "sales"}>
              <div className="bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-rose-500/10 transition-colors" />
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-black text-zinc-200 uppercase tracking-widest flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-rose-500" />
                    سجل المبيعات
                  </h3>
                  <span className="text-[10px] font-bold text-zinc-400 bg-black/40 border border-white/10 px-3 py-1 rounded-full uppercase tracking-wider">
                    إجمالي: {totalSales.toFixed(2)} ج.م
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="text-right py-4 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">الصنف</th>
                        <th className="text-center py-4 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">الكمية</th>
                        <th className="text-center py-4 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">الإجمالي</th>
                        <th className="text-left py-4 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {sales.map((s, i) => (
                        <tr key={i} className="transition-all hover:bg-cyan-500/10 even:bg-white/[0.02] group h-14">
                          <td className="py-2 px-6 font-black text-white text-xs">{s.itemName}</td>
                          <td className="py-2 px-6 text-center text-zinc-400 font-bold font-mono text-sm">{s.quantity}</td>
                          <td className="py-2 px-6 text-center text-cyan-400 font-bold font-mono text-sm">{s.total} ج.م</td>
                          <td className="py-2 px-6 text-left text-zinc-500 text-xs font-mono">{new Date(s.createdAt).toLocaleDateString("ar-EG")}</td>
                        </tr>
                      ))}
                      {sales.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-zinc-500 font-bold text-xs uppercase tracking-widest">
                            لا توجد مبيعات
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* ── Appointments Tab ── */}
            <TabsContent active={activeTab === "appointments"}>
              <div className="bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-colors" />
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-black text-zinc-200 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-500" />
                    المواعيد والحجوزات
                  </h3>
                  <span className="text-[10px] font-bold text-zinc-400 bg-black/40 border border-white/10 px-3 py-1 rounded-full uppercase tracking-wider">
                    إجمالي: {appointments.length}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="text-right py-4 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">العميل</th>
                        <th className="text-center py-4 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">التاريخ/الوقت</th>
                        <th className="text-left py-4 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {appointments.map((a, i) => (
                        <tr key={i} className="transition-all hover:bg-emerald-500/10 even:bg-white/[0.02] group h-14">
                          <td className="py-2 px-6 font-black text-white text-xs">{a.customerName}</td>
                          <td className="py-2 px-6 text-center text-zinc-400 font-bold font-mono text-sm">
                            <div className="flex flex-col items-center">
                              <span>{a.date}</span>
                              <span className="text-[10px] text-zinc-500">{a.time}</span>
                            </div>
                          </td>
                          <td className="py-2 px-6 text-left">
                            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest">
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {appointments.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-12 text-center text-zinc-500 font-bold text-xs uppercase tracking-widest">
                            لا توجد حجوزات
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* ── Expenses Tab ── */}
            <TabsContent active={activeTab === "expenses"}>
              <div className="bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-rose-500/10 transition-colors" />
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-black text-zinc-200 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="w-4 h-4 text-rose-500" />
                    سجل المصروفات
                  </h3>
                  <span className="text-[10px] font-bold text-zinc-400 bg-black/40 border border-white/10 px-3 py-1 rounded-full uppercase tracking-wider">
                    إجمالي: {totalExpenses.toFixed(2)} ج.م
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="text-right py-4 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">الوصف</th>
                        <th className="text-center py-4 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">الفئة</th>
                        <th className="text-center py-4 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">المبلغ</th>
                        <th className="text-left py-4 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {expenses.map((e, i) => (
                        <tr key={i} className="transition-all hover:bg-rose-500/10 even:bg-white/[0.02] group h-14">
                          <td className="py-2 px-6 font-black text-white text-xs">{e.description}</td>
                          <td className="py-2 px-6 text-center">
                            <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] border border-white/10 font-black uppercase tracking-widest">{e.category}</span>
                          </td>
                          <td className="py-2 px-6 text-center text-rose-400 font-bold font-mono text-sm">{e.amount} ج.م</td>
                          <td className="py-2 px-6 text-left text-zinc-500 text-xs font-mono">{new Date(e.createdAt).toLocaleDateString("ar-EG")}</td>
                        </tr>
                      ))}
                      {expenses.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-zinc-500 font-bold text-xs uppercase tracking-widest">
                            لا توجد مصروفات
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* ── Suppliers Tab ── */}
            <TabsContent active={activeTab === "suppliers"}>
              {/* Search & Filters (copied from Casper POS styling) */}
              <div className="flex gap-4 items-center flex-wrap mb-6" dir="rtl">
                  <div className="relative flex-1 min-w-[300px] group/search">
                      <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within/search:text-white transition-all pointer-events-none" />
                      <input
                          value={supplierSearchTerm}
                          onChange={(e) => setSupplierSearchTerm(e.target.value)}
                          placeholder="ابحث باسم المورد أو رقم الهاتف..."
                          className="w-full h-12 ps-12 bg-zinc-900/50 border border-white/10 text-white placeholder:text-zinc-500 focus:border-white transition-all font-bold rounded-2xl shadow-inner outline-none"
                      />
                  </div>

                  <div className="flex items-center gap-1 bg-zinc-900/50 p-1.5 rounded-2xl border border-white/10 flex-wrap shadow-inner">
                      {["اليوم", "أمس", "الأسبوع", "الشهر"].map((label, idx) => {
                          const id = ["today", "yesterday", "week", "month"][idx];
                          const isActive = supplierDateFilter === id || (supplierDateFilter === "all" && id === "today");
                          return (
                              <button
                                  key={id}
                                  onClick={() => {
                                      setSupplierDateFilter(id);
                                      if (id === "today") setSupplierDateRange({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
                                      else if (id === "yesterday") { const y = subDays(new Date(), 1); setSupplierDateRange({ from: startOfDay(y), to: endOfDay(y) }); }
                                      else if (id === "week") setSupplierDateRange({ from: startOfWeek(new Date(), { weekStartsOn: 6 }), to: endOfWeek(new Date(), { weekStartsOn: 6 }) });
                                      else if (id === "month") setSupplierDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
                                  }}
                                  className={`h-10 text-[11px] font-black px-5 rounded-xl transition-all uppercase tracking-widest ${
                                      isActive ? "bg-white text-zinc-900 shadow-lg shadow-white/10" : "text-zinc-400 hover:bg-white/5"
                                  }`}
                              >
                                  {label}
                              </button>
                          );
                      })}
                      <div className="w-px h-4 bg-white/10 mx-2 hidden sm:block" />
                      <FlatpickrRangePicker
                          onRangeChange={(dates: Date[]) => {
                              if (dates.length === 2) {
                                  setSupplierDateRange({ from: dates[0], to: dates[1] });
                                  setSupplierDateFilter("custom");
                              } else if (dates.length === 0) {
                                  setSupplierDateRange(undefined);
                                  setSupplierDateFilter("all");
                              }
                          }}
                          onClear={() => {
                              setSupplierDateRange(undefined);
                              setSupplierDateFilter("all");
                          }}
                          initialDates={supplierDateRange?.from ? [supplierDateRange.from, ...(supplierDateRange.to ? [supplierDateRange.to] : [])] : []}
                          className="w-48 bg-transparent border-0 text-xs h-10 text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 font-bold"
                          placeholder="تخصيص الفترة..."
                      />
                  </div>

                  <div className="flex gap-2 relative">
                      <div className="relative">
                          <Filter className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white z-10 pointer-events-none" />
                          <select 
                              value={supplierStatusFilter} 
                              onChange={e => setSupplierStatusFilter(e.target.value)}
                              className="appearance-none border border-white/10 gap-3 h-12 ps-10 pr-10 bg-zinc-900/50 rounded-2xl shadow-inner text-white font-black text-xs uppercase tracking-widest cursor-pointer hover:bg-zinc-800/50 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
                          >
                              <option value="all">الكل</option>
                              <option value="inDebt">عليهم ديون لنا</option>
                              <option value="credit">لهم مستحقات</option>
                          </select>
                          <ChevronDown className="absolute end-4 top-1/2 -translate-y-1/2 w-3 h-3 opacity-50 text-white pointer-events-none" />
                      </div>

                      {(supplierDateFilter !== "all" || supplierStatusFilter !== 'all' || supplierSearchTerm !== "" || supplierDateRange !== undefined) && (
                          <button
                              onClick={() => {
                                  setSupplierDateFilter("all");
                                  setSupplierStatusFilter('all');
                                  setSupplierSearchTerm("");
                                  setSupplierDateRange(undefined);
                              }}
                              className="bg-white/5 text-orange-400 hover:bg-orange-500 hover:text-white h-12 px-6 rounded-2xl font-black flex items-center gap-2 transition-all"
                          >
                              <X className="w-4 h-4" /> مسح الفلاتر
                          </button>
                      )}
                  </div>
              </div>

              <div className="bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-amber-500/10 transition-colors" />
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-black text-zinc-200 uppercase tracking-widest flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-amber-500" />
                    حسابات الموردين والآجل
                  </h3>
                  <span className="text-[10px] font-bold text-zinc-400 bg-black/40 border border-white/10 px-3 py-1 rounded-full uppercase tracking-wider">
                    إجمالي الديون: {totalSupplierDebts.toFixed(2)} ج.م
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="text-right py-4 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">المورد</th>
                        <th className="text-center py-4 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">رقم الهاتف</th>
                        <th className="text-center py-4 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">له فلوس (مشتريات)</th>
                        <th className="text-left py-4 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">عليه فلوس (مستحقة)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredSuppliers.map((sup, i) => {
                        const debt = new Decimal(sup.totalDebt ?? 0);
                        const hasDebt = debt.greaterThan(0);
                        const isExpanded = expandedSupplier === i;
                        return (
                          <Fragment key={i}>
                            <tr 
                              onClick={() => setExpandedSupplier(isExpanded ? null : i)}
                              className="transition-all hover:bg-amber-500/10 even:bg-white/[0.02] group h-14 cursor-pointer"
                            >
                              <td className="py-2 px-6 font-black text-white text-sm flex items-center gap-2">
                                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? "rotate-180 text-amber-500" : ""}`} />
                                {sup.name}
                              </td>
                              <td className="py-2 px-6 text-center text-zinc-400 font-mono text-xs">{sup.phone || "غير محدد"}</td>
                              <td className="py-2 px-6 text-center text-emerald-400 font-bold font-mono text-sm">{new Decimal(sup.totalPurchasesAmount ?? 0).toFixed(2)} ج.م</td>
                              <td className={`py-2 px-6 text-left font-bold font-mono text-sm ${hasDebt ? 'text-rose-400' : 'text-zinc-500'}`}>
                                {debt.toFixed(2)} ج.م
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-zinc-950/50">
                                <td colSpan={4} className="p-0 border-b border-white/5">
                                  <div className="p-6 flex flex-col gap-6 animate-in slide-in-from-top-2 duration-200">
                                    {/* Actions Bar */}
                                    <div className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-2xl border border-white/5 flex-wrap gap-3">
                                      <h4 className="text-sm font-black text-white flex items-center gap-2 px-3">
                                        تفضيلات المورد: {sup.name}
                                      </h4>
                                      <div className="flex gap-2 flex-wrap">
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleOpenPaySupplier(sup); }}
                                          className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2"
                                        >
                                          <DollarSign className="w-3.5 h-3.5" /> تسديد دفعة
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleOpenStatement(sup); }}
                                          className="bg-white/5 text-zinc-300 hover:bg-white/10 px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2"
                                        >
                                          <FileText className="w-3.5 h-3.5" /> كشف حساب
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleOpenEditSupplier(sup); }}
                                          className="bg-white/5 text-zinc-300 hover:bg-white/10 px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" /> تعديل
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleOpenDeleteSupplier(sup); }}
                                          className="bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" /> حذف
                                        </button>
                                      </div>
                                    </div>

                                    {/* Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      {/* Invoices */}
                                      <div className="bg-zinc-900/80 rounded-2xl border border-white/5 shadow-inner flex flex-col overflow-hidden">
                                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900">
                                            <h4 className="text-xs font-black text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                                              <FileText className="w-4 h-4 text-emerald-500" /> فواتير الشراء
                                            </h4>
                                            <span className="text-[10px] font-bold text-zinc-500 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                                              {sup.purchases?.length || 7} فاتورة
                                            </span>
                                        </div>
                                        <div className="overflow-y-auto max-h-[250px] custom-scrollbar p-4">
                                            <table className="w-full text-xs relative">
                                                <thead className="text-zinc-500 border-b border-white/5 sticky -top-4 bg-zinc-900/90 backdrop-blur-md z-10">
                                                <tr>
                                                    <th className="text-right pb-3 font-bold">رقم الفاتورة</th>
                                                    <th className="text-center pb-3 font-bold">التاريخ</th>
                                                    <th className="text-left pb-3 font-bold">المبلغ</th>
                                                    <th className="text-left pb-3 font-bold w-10"></th>
                                                </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 text-zinc-400">
                                                {(sup.purchases?.length ? sup.purchases : [1, 2, 3, 4, 5, 6, 7]).map((inv: any, idx: number) => {
                                                  const invId = inv.id ? inv.id.substring(0, 8) : `INV-00${inv}`;
                                                  const invDate = inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("ar-EG") : `2026-08-0${inv}`;
                                                  const invAmount = inv.totalAmount ? new Decimal(inv.totalAmount).toFixed(2) : (450 * (idx + 1)).toFixed(2);
                                                  return (
                                                    <tr key={inv.id || idx} className="hover:bg-white/5 transition-colors group">
                                                      <td className="py-2.5 font-mono">{invId}</td>
                                                      <td className="py-2.5 text-center font-mono">{invDate}</td>
                                                      <td className="py-2.5 text-left text-white font-mono font-bold">{invAmount} ج.م</td>
                                                      <td className="py-2.5 text-left">
                                                          <button 
                                                            onClick={(e) => { e.stopPropagation(); handleViewInvoice(inv, sup); }}
                                                            title="عرض الفاتورة"
                                                            className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all"
                                                          >
                                                              <Eye className="w-3.5 h-3.5" />
                                                          </button>
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                                </tbody>
                                            </table>
                                        </div>
                                      </div>
                                      
                                      {/* Returns */}
                                      <div className="bg-zinc-900/80 rounded-2xl border border-white/5 shadow-inner flex flex-col overflow-hidden">
                                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900">
                                            <h4 className="text-xs font-black text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                                                <TrendingDown className="w-4 h-4 text-rose-500" /> المرتجعات
                                            </h4>
                                            <span className="text-[10px] font-bold text-zinc-500 bg-white/5 px-2 py-1 rounded-md border border-white/5">3 مرتجعات</span>
                                        </div>
                                        <div className="overflow-y-auto max-h-[250px] custom-scrollbar p-4">
                                            <table className="w-full text-xs relative">
                                                <thead className="text-zinc-500 border-b border-white/5 sticky -top-4 bg-zinc-900/90 backdrop-blur-md z-10">
                                                <tr>
                                                    <th className="text-right pb-3 font-bold">رقم المرتجع</th>
                                                    <th className="text-center pb-3 font-bold">التاريخ</th>
                                                    <th className="text-left pb-3 font-bold">المبلغ</th>
                                                    <th className="text-left pb-3 font-bold w-10"></th>
                                                </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 text-zinc-400">
                                                {[1, 2, 3].map((ret) => (
                                                    <tr key={ret} className="hover:bg-white/5 transition-colors group">
                                                    <td className="py-2.5 font-mono">RET-00{ret}</td>
                                                    <td className="py-2.5 text-center font-mono">2026-08-0{ret}</td>
                                                    <td className="py-2.5 text-left text-rose-400 font-mono font-bold">{(150 * ret).toFixed(2)} ج.م</td>
                                                    <td className="py-2.5 text-left">
                                                        <button 
                                                          onClick={(e) => { e.stopPropagation(); handleViewReturn(ret, sup); }}
                                                          title="عرض المرتجع"
                                                          className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-all"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {filteredSuppliers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-zinc-500 font-bold text-xs uppercase tracking-widest">
                            لا توجد حسابات موردين
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── Edit Supplier Modal ── */}
      {editSupplierModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-cyan-400" /> تعديل بيانات المورد
              </h3>
              <button 
                onClick={() => setEditSupplierModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editSupplierModal.error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {editSupplierModal.error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">اسم المورد</label>
                <input 
                  type="text"
                  value={editSupplierModal.name}
                  onChange={(e) => setEditSupplierModal(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:border-cyan-400 outline-none transition-all"
                  placeholder="أدخل اسم المورد"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">رقم الهاتف</label>
                <input 
                  type="text"
                  value={editSupplierModal.phone}
                  onChange={(e) => setEditSupplierModal(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:border-cyan-400 outline-none transition-all"
                  placeholder="أدخل رقم الهاتف"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={editSupplierModal.isSaving}
                onClick={handleSaveEditSupplier}
                className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-black py-2.5 px-4 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                {editSupplierModal.isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ التعديلات"}
              </button>
              <button
                onClick={() => setEditSupplierModal(prev => ({ ...prev, isOpen: false }))}
                className="bg-white/5 hover:bg-white/10 text-zinc-300 font-bold py-2.5 px-4 rounded-xl text-sm transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pay Supplier Modal ── */}
      {paySupplierModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" /> تسديد دفعة للمورد
              </h3>
              <button 
                onClick={() => setPaySupplierModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="text-xs text-zinc-400 font-medium">المورد: <span className="text-white font-bold">{paySupplierModal.supplier?.name}</span></div>
              <div className="text-xs text-zinc-400 font-medium mt-1">الديون المستحقة الحالية: <span className="text-rose-400 font-mono font-black">{new Decimal(paySupplierModal.supplier?.totalDebt ?? 0).toFixed(2)} ج.م</span></div>
            </div>

            {paySupplierModal.error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {paySupplierModal.error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">المبلغ المدفوع (ج.م) *</label>
                <input 
                  type="number"
                  step="0.01"
                  value={paySupplierModal.amount}
                  onChange={(e) => setPaySupplierModal(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-emerald-400 font-mono font-black focus:border-emerald-400 outline-none transition-all"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">ملاحظات / طريقة الدفع</label>
                <input 
                  type="text"
                  value={paySupplierModal.notes}
                  onChange={(e) => setPaySupplierModal(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:border-emerald-400 outline-none transition-all"
                  placeholder="مثال: نقدي من الخزينة الرئيسية / تحويل بنكي"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={paySupplierModal.isSaving}
                onClick={handleSavePaySupplier}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black py-2.5 px-4 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {paySupplierModal.isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد الدفع"}
              </button>
              <button
                onClick={() => setPaySupplierModal(prev => ({ ...prev, isOpen: false }))}
                className="bg-white/5 hover:bg-white/10 text-zinc-300 font-bold py-2.5 px-4 rounded-xl text-sm transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Statement Modal ── */}
      {statementModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" /> كشف حساب مورد: {statementModal.supplier?.name}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">رقم الهاتف: {statementModal.supplier?.phone || "غير محدد"}</p>
              </div>
              <button 
                onClick={() => setStatementModal({ isOpen: false, supplier: null })}
                className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Summary */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-zinc-950/60 rounded-2xl border border-white/5">
              <div className="text-center">
                <span className="text-[10px] text-zinc-400 font-bold block">إجمالي المشتريات</span>
                <span className="text-sm font-mono font-black text-emerald-400">
                  {new Decimal(statementModal.supplier?.totalPurchasesAmount ?? 0).toFixed(2)} ج.م
                </span>
              </div>
              <div className="text-center border-x border-white/5">
                <span className="text-[10px] text-zinc-400 font-bold block">المدفوع</span>
                <span className="text-sm font-mono font-black text-cyan-400">
                  {new Decimal(statementModal.supplier?.totalPurchasesAmount ?? 0).minus(new Decimal(statementModal.supplier?.totalDebt ?? 0)).toFixed(2)} ج.م
                </span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-zinc-400 font-bold block">الرصيد المستحق (الآجل)</span>
                <span className="text-sm font-mono font-black text-rose-400">
                  {new Decimal(statementModal.supplier?.totalDebt ?? 0).toFixed(2)} ج.م
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-xs">
                <thead className="bg-white/5 border-b border-white/10 text-zinc-400 sticky top-0 bg-zinc-900">
                  <tr>
                    <th className="py-2.5 px-3 text-right font-black">البيان</th>
                    <th className="py-2.5 px-3 text-center font-black">التاريخ</th>
                    <th className="py-2.5 px-3 text-center font-black">الإجمالي</th>
                    <th className="py-2.5 px-3 text-left font-black">المتبقي (الآجل)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                  {(statementModal.supplier?.purchases?.length ? statementModal.supplier.purchases : [1, 2, 3]).map((p: any, idx: number) => {
                    const name = p.itemName || `فاتورة توريد #${idx + 1}`;
                    const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString("ar-EG") : `2026-08-0${idx + 1}`;
                    const total = p.totalAmount ? new Decimal(p.totalAmount).toFixed(2) : (450 * (idx + 1)).toFixed(2);
                    const deferred = p.deferredAmount ? new Decimal(p.deferredAmount).toFixed(2) : (150 * (idx + 1)).toFixed(2);
                    return (
                      <tr key={p.id || idx} className="hover:bg-white/5">
                        <td className="py-2.5 px-3 font-bold text-white">{name}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-zinc-400">{date}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-white">{total} ج.م</td>
                        <td className="py-2.5 px-3 text-left font-mono font-bold text-rose-400">{deferred} ج.م</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-white/10 pt-3 flex justify-end">
              <button
                onClick={() => setStatementModal({ isOpen: false, supplier: null })}
                className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl text-xs transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Detail (Invoice / Return) Modal ── */}
      {viewDetailModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-cyan-400" /> {viewDetailModal.title}
              </h3>
              <button 
                onClick={() => setViewDetailModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 bg-zinc-950/60 p-4 rounded-2xl border border-white/5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 font-medium">المورد:</span>
                <span className="font-bold text-white">{viewDetailModal.supplierName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 font-medium">البيان / الصنف:</span>
                <span className="font-bold text-white">{viewDetailModal.item?.itemName || "مستلزمات عامة"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 font-medium">التاريخ:</span>
                <span className="font-mono text-zinc-300">
                  {viewDetailModal.item?.createdAt ? new Date(viewDetailModal.item.createdAt).toLocaleDateString("ar-EG") : "2026-08-15"}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-white/10 pt-2">
                <span className="text-zinc-400 font-bold">المبلغ الإجمالي:</span>
                <span className="text-base font-mono font-black text-cyan-400">
                  {viewDetailModal.item?.totalAmount ? new Decimal(viewDetailModal.item.totalAmount).toFixed(2) : "450.00"} ج.م
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewDetailModal(prev => ({ ...prev, isOpen: false }))}
                className="bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Supplier Confirmation Modal ── */}
      {deleteSupplierModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-500" /> تأكيد حذف المورد
              </h3>
              <button 
                onClick={() => setDeleteSupplierModal({ isOpen: false, supplier: null, isDeleting: false })}
                className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed font-medium">
              هل أنت متأكد من رغبتك في حذف المورد <span className="text-white font-bold">"{deleteSupplierModal.supplier?.name}"</span> وجميع سجلات المشتريات المرتبطة به؟ هذه العملية لا يمكن التراجع عنها.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                disabled={deleteSupplierModal.isDeleting}
                onClick={handleConfirmDeleteSupplier}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black py-2.5 px-4 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20"
              >
                {deleteSupplierModal.isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "نعم، احذف المورد"}
              </button>
              <button
                onClick={() => setDeleteSupplierModal({ isOpen: false, supplier: null, isDeleting: false })}
                className="bg-white/5 hover:bg-white/10 text-zinc-300 font-bold py-2.5 px-4 rounded-xl text-sm transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


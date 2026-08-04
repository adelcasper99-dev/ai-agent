// app/dashboard/reports/page.tsx
"use client";

import { useEffect, useState, Fragment } from "react";
import Decimal from "decimal.js";
import * as XLSX from "xlsx";
import { 
  TrendingUp, TrendingDown, ShoppingBag, DollarSign, 
  Filter, Calendar as CalendarIcon, FileText,
  BarChart2, Clock, Users, Search, ChevronDown, X, Edit2, Eye,
  Download, AlertTriangle, Layers, Tag, User, Store, Phone, Truck
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
    <div className="bg-zinc-900 border border-white/10 inline-flex p-1 rounded-xl shadow-lg">
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
    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 relative overflow-hidden backdrop-blur-xl group hover:border-white/10 transition-colors shadow-2xl">
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

  useEffect(() => {
    Promise.all([
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/sales").then((r) => r.json()),
      fetch("/api/appointments").then((r) => r.json()),
      fetch("/api/reports/suppliers").then((r) => r.json()),
    ]).then(([e, s, a, sup]) => {
      setExpenses(e.expenses || []);
      setSales(s.sales || []);
      setAppointments(a.appointments || []);
      setSuppliers(sup.suppliers || []);
      setLoading(false);
    });
  }, []);

  // Fetch Sales Analysis when groupBy changes
  useEffect(() => {
    if (activeTab !== "sales_analysis") return;
    setSalesAnalysisLoading(true);
    fetch(`/api/reports/sales-analysis?groupBy=${salesGroupBy}`)
      .then(r => r.json())
      .then(data => { setSalesAnalysis(data); setSalesAnalysisLoading(false); })
      .catch(() => setSalesAnalysisLoading(false));
  }, [salesGroupBy, activeTab]);

  // Fetch Aged Receivables on tab open
  useEffect(() => {
    if (activeTab !== "aged_receivables" || agedReceivables) return;
    setAgedLoading(true);
    fetch("/api/reports/aged-receivables")
      .then(r => r.json())
      .then(data => { setAgedReceivables(data); setAgedLoading(false); })
      .catch(() => setAgedLoading(false));
  }, [activeTab]);

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
      style={{ background: "#050508", color: "#e4e4e7" }}
      dir="rtl"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* ── Page Header & Filters ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-zinc-900/50 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <BarChart2 className="text-cyan-400" />
              مركز التقارير والتحليلات
            </h1>
            <p className="text-zinc-400 text-sm mt-1 font-medium">التقارير المالية والتحليلات المتقدمة (Casper POS)</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 p-1 rounded-xl bg-zinc-900 border border-white/10">
              <select className="bg-transparent border-none text-sm font-bold text-zinc-300 focus:ring-0 px-3 py-2 outline-none cursor-pointer">
                <option>كل الفروع</option>
                <option>الفرع الرئيسي</option>
              </select>
              <div className="w-px h-5 bg-white/10 mx-1" />
              <select className="bg-transparent border-none text-sm font-bold text-cyan-400 focus:ring-0 px-3 py-2 outline-none cursor-pointer">
                <option>أعلى إيراد</option>
                <option>أكثر كمية</option>
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
                                    <div className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-2xl border border-white/5">
                                      <h4 className="text-sm font-black text-white flex items-center gap-2 px-3">
                                        تفضيلات المورد: {sup.name}
                                      </h4>
                                      <div className="flex gap-2">
                                        <button className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2">
                                          <DollarSign className="w-3 h-3" /> تسديد دفعة
                                        </button>
                                        <button className="bg-white/5 text-zinc-300 hover:bg-white/10 px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2">
                                          <FileText className="w-3 h-3" /> كشف حساب
                                        </button>
                                        <button className="bg-white/5 text-zinc-300 hover:bg-white/10 px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2">
                                          <Edit2 className="w-3 h-3" /> تعديل
                                        </button>
                                      </div>
                                    </div>

                                    {/* Grid */}
                                    <div className="grid grid-cols-2 gap-6">
                                      {/* Invoices */}
                                      <div className="bg-zinc-900/80 rounded-2xl border border-white/5 shadow-inner flex flex-col overflow-hidden">
                                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900">
                                            <h4 className="text-xs font-black text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                                              <FileText className="w-4 h-4 text-emerald-500" /> فواتير الشراء
                                            </h4>
                                            <span className="text-[10px] font-bold text-zinc-500 bg-white/5 px-2 py-1 rounded-md border border-white/5">12 فاتورة</span>
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
                                                {[1, 2, 3, 4, 5, 6, 7].map((inv) => (
                                                    <tr key={inv} className="hover:bg-white/5 transition-colors group">
                                                    <td className="py-2.5 font-mono">INV-00{inv}</td>
                                                    <td className="py-2.5 text-center font-mono">2026-08-0{inv}</td>
                                                    <td className="py-2.5 text-left text-white font-mono font-bold">{(450 * inv).toFixed(2)} ج.م</td>
                                                    <td className="py-2.5 text-left">
                                                        <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all">
                                                            <Eye className="w-3 h-3" />
                                                        </button>
                                                    </td>
                                                    </tr>
                                                ))}
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
                                                        <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-all">
                                                            <Eye className="w-3 h-3" />
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
    </div>
  );
}

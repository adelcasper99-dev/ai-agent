// app/dashboard/reports/page.tsx
"use client";

import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { TrendingUp, TrendingDown, ShoppingBag, DollarSign } from "lucide-react";

export default function ReportsPage() {
  const [expenses,     setExpenses]     = useState<any[]>([]);
  const [sales,        setSales]        = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [suppliers,    setSuppliers]    = useState<any[]>([]);
  const [purchases,    setPurchases]    = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/sales").then((r) => r.json()),
      fetch("/api/appointments").then((r) => r.json()),
      fetch("/api/reports/suppliers").then((r) => r.json()),
      fetch("/api/purchases").then((r) => r.json()),
    ]).then(([e, s, a, sup, p]) => {
      setExpenses(e.expenses   || []);
      setSales(s.sales         || []);
      setAppointments(a.appointments || []);
      setSuppliers(sup.suppliers || []);
      setPurchases(p.purchases || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bento-card p-5 space-y-3">
              <div className="shimmer h-8 w-10 rounded-lg" />
              <div className="shimmer h-6 w-20 rounded" />
              <div className="shimmer h-3 w-16 rounded" />
            </div>
          ))}
        </div>
        <div className="bento-card p-6">
          <div className="shimmer h-4 w-40 rounded mb-4" />
          {[1,2,3].map(i => <div key={i} className="shimmer h-10 w-full rounded mb-2" />)}
        </div>
      </div>
    );
  }

  // ── Decimal-safe aggregations ─────────────────────────────────────────────
  const totalExpenses       = expenses.reduce((acc, e) => acc.plus(new Decimal(e.amount ?? 0)), new Decimal(0));
  const totalSales          = sales.reduce((acc, s) => acc.plus(new Decimal(s.total ?? 0)), new Decimal(0));
  const totalPurchases      = purchases.reduce((acc, p) => acc.plus(new Decimal(p.totalAmount ?? 0)), new Decimal(0));
  const totalSupplierDebts  = suppliers.reduce((acc, s) => acc.plus(new Decimal(s.totalDebt ?? 0)), new Decimal(0));
  const netProfit           = totalSales.minus(totalExpenses).minus(totalPurchases);

  // ── KPI card definitions ──────────────────────────────────────────────────
  const kpis = [
    {
      label: "صافي الربح",
      value: netProfit.toFixed(2),
      currency: "ج.م",
      isPositive: netProfit.greaterThanOrEqualTo(0),
      Icon: netProfit.greaterThanOrEqualTo(0) ? TrendingUp : TrendingDown,
      iconBg: netProfit.greaterThanOrEqualTo(0) ? "rgba(21,132,110,0.14)" : "rgba(229,72,77,0.12)",
      iconColor: netProfit.greaterThanOrEqualTo(0) ? "#1fc9a4" : "var(--color-danger)",
      valueColor: netProfit.greaterThanOrEqualTo(0) ? "#1fc9a4" : "var(--color-danger)",
      sub: null,
    },
    {
      label: "إجمالي المشتريات",
      value: totalPurchases.toFixed(2),
      currency: "ج.م",
      isPositive: false,
      Icon: ShoppingBag,
      iconBg: "rgba(229,72,77,0.12)",
      iconColor: "var(--color-danger)",
      valueColor: "var(--color-danger)",
      sub: `(ديون موردين: ${totalSupplierDebts.toFixed(2)} ج.م)`,
    },
    {
      label: "إجمالي المصروفات",
      value: totalExpenses.toFixed(2),
      currency: "ج.م",
      isPositive: false,
      Icon: DollarSign,
      iconBg: "rgba(229,72,77,0.12)",
      iconColor: "var(--color-danger)",
      valueColor: "var(--color-danger)",
      sub: null,
    },
    {
      label: "إجمالي المبيعات",
      value: totalSales.toFixed(2),
      currency: "ج.م",
      isPositive: true,
      Icon: TrendingUp,
      iconBg: "rgba(21,132,110,0.14)",
      iconColor: "#1fc9a4",
      valueColor: "#1fc9a4",
      sub: null,
    },
  ];

  // ── Shared table header cell style ────────────────────────────────────────
  const TH = ({ children }: { children: React.ReactNode }) => (
    <th
      className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider"
      style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border-glass)" }}
    >
      {children}
    </th>
  );

  const TD = ({
    children,
    className = "",
    style = {},
  }: {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }) => (
    <td
      className={`px-4 py-3 text-sm ${className}`}
      style={{
        color: "var(--color-text-secondary)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        ...style,
      }}
    >
      {children}
    </td>
  );

  return (
    <div className="space-y-6 max-w-6xl">

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bento-card p-5 flex flex-col gap-2">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-1"
              style={{ background: kpi.iconBg }}
            >
              <kpi.Icon size={20} style={{ color: kpi.iconColor }} />
            </div>
            <p
              className="text-2xl font-bold tabular-nums leading-none"
              style={{ color: kpi.valueColor }}
            >
              {kpi.value}
            </p>
            <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              {kpi.label}
            </p>
            {kpi.sub && (
              <p className="text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                {kpi.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Suppliers & Debts ── */}
      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold" style={{ color: "var(--color-text-primary)" }}>
            حسابات الموردين والآجل
          </h2>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full tabular-nums"
            style={{
              background: "rgba(255,184,41,0.14)",
              color: "var(--color-warning)",
              border: "1px solid rgba(255,184,41,0.28)",
            }}
          >
            إجمالي الديون: {totalSupplierDebts.toFixed(2)} ج.م
          </span>
        </div>
        <div className="bento-card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr>
                <TH>اسم المورد</TH>
                <TH>رقم الهاتف</TH>
                <TH>إجمالي التعاملات</TH>
                <TH>الدين الآجل المستحق</TH>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    لا توجد حسابات موردين مسجلة.
                  </td>
                </tr>
              ) : (
                suppliers.map((sup) => (
                  <tr
                    key={sup.id}
                    className="transition-colors duration-150"
                    style={{ "--hover-bg": "rgba(255,255,255,0.03)" } as React.CSSProperties}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <TD style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{sup.name}</TD>
                    <TD>{sup.phone || "غير محدد"}</TD>
                    <TD className="tabular-nums">{new Decimal(sup.totalPurchasesAmount ?? 0).toFixed(2)} ج.م</TD>
                    <TD
                      className="font-bold tabular-nums"
                      style={{
                        color: new Decimal(sup.totalDebt ?? 0).greaterThan(0)
                          ? "var(--color-danger)"
                          : "var(--color-text-muted)",
                      }}
                    >
                      {new Decimal(sup.totalDebt ?? 0).toFixed(2)} ج.م
                    </TD>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Sales ── */}
      <section className="space-y-3">
        <h2 className="text-base font-bold" style={{ color: "var(--color-text-primary)" }}>
          المبيعات
        </h2>
        <div className="bento-card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr>
                <TH>الصنف</TH>
                <TH>السعر</TH>
                <TH>الكمية</TH>
                <TH>الإجمالي</TH>
                <TH>التاريخ</TH>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr
                  key={s.id}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <TD style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{s.itemName}</TD>
                  <TD className="tabular-nums">{s.price}</TD>
                  <TD className="tabular-nums">{s.quantity}</TD>
                  <TD className="tabular-nums font-bold" style={{ color: "#1fc9a4" }}>{s.total}</TD>
                  <TD style={{ color: "var(--color-text-muted)" }}>
                    {new Date(s.createdAt).toLocaleDateString("ar-EG")}
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Expenses ── */}
      <section className="space-y-3">
        <h2 className="text-base font-bold" style={{ color: "var(--color-text-primary)" }}>
          المصروفات
        </h2>
        <div className="bento-card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr>
                <TH>الوصف</TH>
                <TH>الفئة</TH>
                <TH>المبلغ</TH>
                <TH>التاريخ</TH>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr
                  key={e.id}
                  onMouseEnter={(ev) => (ev.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
                >
                  <TD style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{e.description}</TD>
                  <TD>{e.category}</TD>
                  <TD className="tabular-nums font-bold" style={{ color: "var(--color-danger)" }}>{e.amount}</TD>
                  <TD style={{ color: "var(--color-text-muted)" }}>
                    {new Date(e.createdAt).toLocaleDateString("ar-EG")}
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Appointments ── */}
      <section className="space-y-3">
        <h2 className="text-base font-bold" style={{ color: "var(--color-text-primary)" }}>
          المواعيد المحجوزة
        </h2>
        <div className="bento-card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr>
                <TH>العميل</TH>
                <TH>التاريخ</TH>
                <TH>الوقت</TH>
                <TH>ملاحظات</TH>
                <TH>الحالة</TH>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr
                  key={a.id}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <TD style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{a.customerName}</TD>
                  <TD>{a.date}</TD>
                  <TD>{a.time}</TD>
                  <TD>{a.notes}</TD>
                  <TD>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(21,132,110,0.14)",
                        color: "#1fc9a4",
                        border: "1px solid rgba(21,132,110,0.28)",
                      }}
                    >
                      {a.status}
                    </span>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

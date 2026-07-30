// app/dashboard/reports/page.tsx
"use client";

import { useEffect, useState } from "react";

export default function ReportsPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/sales").then((r) => r.json()),
      fetch("/api/appointments").then((r) => r.json()),
      fetch("/api/reports/suppliers").then((r) => r.json()),
      fetch("/api/purchases").then((r) => r.json()),
    ]).then(([e, s, a, sup, p]) => {
      setExpenses(e.expenses || []);
      setSales(s.sales || []);
      setAppointments(a.appointments || []);
      setSuppliers(sup.suppliers || []);
      setPurchases(p.purchases || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="p-4 text-slate-500">جاري تحميل التقارير...</p>;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const totalSupplierDebts = suppliers.reduce((sum, sup) => sum + (sup.totalDebt || 0), 0);
  const netProfit = totalSales - totalExpenses - totalPurchases;

  return (
    <div className="space-y-8 max-w-6xl dir-rtl">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border bg-white rounded-xl p-4 text-center shadow-sm">
          <p className="text-gray-500 text-xs font-medium">إجمالي المبيعات</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{totalSales.toFixed(2)} ج.م</p>
        </div>
        <div className="border bg-white rounded-xl p-4 text-center shadow-sm">
          <p className="text-gray-500 text-xs font-medium">إجمالي المصروفات</p>
          <p className="text-xl font-bold text-rose-600 mt-1">{totalExpenses.toFixed(2)} ج.م</p>
        </div>
        <div className="border bg-white rounded-xl p-4 text-center shadow-sm">
          <p className="text-gray-500 text-xs font-medium">إجمالي المشتريات</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{totalPurchases.toFixed(2)} ج.م</p>
          <p className="text-xs text-amber-700 mt-0.5">(ديون مواردين: {totalSupplierDebts.toFixed(2)}ج)</p>
        </div>
        <div className="border bg-white rounded-xl p-4 text-center shadow-sm">
          <p className="text-gray-500 text-xs font-medium">صافي الربح</p>
          <p className={`text-xl font-bold mt-1 ${netProfit >= 0 ? "text-blue-600" : "text-red-600"}`}>
            {netProfit.toFixed(2)} ج.م
          </p>
        </div>
      </div>

      {/* 📦 Suppliers & Credit Accounts Section */}
      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-slate-800 text-lg">💳 حسابات الموردين والآجل</h2>
          <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-full">
            إجمالي الديون: {totalSupplierDebts.toFixed(2)} ج.م
          </span>
        </div>
        <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-3 text-right font-semibold text-slate-700">اسم المورد</th>
                <th className="p-3 text-right font-semibold text-slate-700">رقم الهاتف</th>
                <th className="p-3 text-right font-semibold text-slate-700">إجمالي التعاملات</th>
                <th className="p-3 text-right font-semibold text-slate-700">الدين الآجل المستحق</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-400 text-sm">
                    لا توجد حسابات موردين مسجلة.
                  </td>
                </tr>
              ) : (
                suppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-800">{sup.name}</td>
                    <td className="p-3 text-slate-600">{sup.phone || "غير محدد"}</td>
                    <td className="p-3 text-slate-700 font-semibold">{(sup.totalPurchasesAmount || 0).toFixed(2)} ج.م</td>
                    <td className="p-3 font-bold text-rose-600">{(sup.totalDebt || 0).toFixed(2)} ج.م</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sales Section */}
      <section className="space-y-3">
        <h2 className="font-bold text-slate-800 text-lg">المبيعات</h2>
        <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-3 text-right font-semibold text-slate-700">الصنف</th>
                <th className="p-3 text-right font-semibold text-slate-700">السعر</th>
                <th className="p-3 text-right font-semibold text-slate-700">الكمية</th>
                <th className="p-3 text-right font-semibold text-slate-700">الإجمالي</th>
                <th className="p-3 text-right font-semibold text-slate-700">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">{s.itemName}</td>
                  <td className="p-3 text-slate-600">{s.price}</td>
                  <td className="p-3 text-slate-600">{s.quantity}</td>
                  <td className="p-3 font-semibold text-emerald-600">{s.total}</td>
                  <td className="p-3 text-slate-500">{new Date(s.createdAt).toLocaleDateString("ar-EG")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Expenses Section */}
      <section className="space-y-3">
        <h2 className="font-bold text-slate-800 text-lg">المصروفات</h2>
        <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-3 text-right font-semibold text-slate-700">الوصف</th>
                <th className="p-3 text-right font-semibold text-slate-700">الفئة</th>
                <th className="p-3 text-right font-semibold text-slate-700">المبلغ</th>
                <th className="p-3 text-right font-semibold text-slate-700">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">{e.description}</td>
                  <td className="p-3 text-slate-600">{e.category}</td>
                  <td className="p-3 font-semibold text-rose-600">{e.amount}</td>
                  <td className="p-3 text-slate-500">{new Date(e.createdAt).toLocaleDateString("ar-EG")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Appointments Section */}
      <section className="space-y-3">
        <h2 className="font-bold text-slate-800 text-lg">المواعيد المحجوزة</h2>
        <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-3 text-right font-semibold text-slate-700">العميل</th>
                <th className="p-3 text-right font-semibold text-slate-700">التاريخ</th>
                <th className="p-3 text-right font-semibold text-slate-700">الوقت</th>
                <th className="p-3 text-right font-semibold text-slate-700">ملاحظات</th>
                <th className="p-3 text-right font-semibold text-slate-700">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {appointments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">{a.customerName}</td>
                  <td className="p-3 text-slate-600">{a.date}</td>
                  <td className="p-3 text-slate-600">{a.time}</td>
                  <td className="p-3 text-slate-600">{a.notes}</td>
                  <td className="p-3">
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}


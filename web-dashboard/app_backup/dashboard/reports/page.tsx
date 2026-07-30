// app/dashboard/reports/page.tsx
"use client";

import { useEffect, useState } from "react";

export default function ReportsPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/sales").then((r) => r.json()),
      fetch("/api/appointments").then((r) => r.json()),
    ]).then(([e, s, a]) => {
      setExpenses(e.expenses);
      setSales(s.sales);
      setAppointments(a.appointments);
      setLoading(false);
    });
  }, []);

  if (loading) return <p>جاري التحميل...</p>;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalSales = sales.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 text-center">
          <p className="text-gray-500 text-sm">إجمالي المبيعات</p>
          <p className="text-2xl font-bold text-green-600">{totalSales.toFixed(2)} جنيه</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <p className="text-gray-500 text-sm">إجمالي المصروفات</p>
          <p className="text-2xl font-bold text-red-600">{totalExpenses.toFixed(2)} جنيه</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <p className="text-gray-500 text-sm">صافي</p>
          <p className="text-2xl font-bold">{(totalSales - totalExpenses).toFixed(2)} جنيه</p>
        </div>
      </div>

      <section>
        <h2 className="font-semibold mb-2">المبيعات</h2>
        <table className="w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-right">الصنف</th>
              <th className="p-2 text-right">السعر</th>
              <th className="p-2 text-right">الكمية</th>
              <th className="p-2 text-right">الإجمالي</th>
              <th className="p-2 text-right">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-2">{s.itemName}</td>
                <td className="p-2">{s.price}</td>
                <td className="p-2">{s.quantity}</td>
                <td className="p-2">{s.total}</td>
                <td className="p-2">{new Date(s.createdAt).toLocaleDateString("ar-EG")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-semibold mb-2">المصروفات</h2>
        <table className="w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-right">الوصف</th>
              <th className="p-2 text-right">الفئة</th>
              <th className="p-2 text-right">المبلغ</th>
              <th className="p-2 text-right">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-2">{e.description}</td>
                <td className="p-2">{e.category}</td>
                <td className="p-2">{e.amount}</td>
                <td className="p-2">{new Date(e.createdAt).toLocaleDateString("ar-EG")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-semibold mb-2">المواعيد</h2>
        <table className="w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-right">العميل</th>
              <th className="p-2 text-right">التاريخ</th>
              <th className="p-2 text-right">الوقت</th>
              <th className="p-2 text-right">ملاحظات</th>
              <th className="p-2 text-right">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-2">{a.customerName}</td>
                <td className="p-2">{a.date}</td>
                <td className="p-2">{a.time}</td>
                <td className="p-2">{a.notes}</td>
                <td className="p-2">{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

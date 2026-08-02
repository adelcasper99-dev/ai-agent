"use client";

import { useState, useEffect } from "react";

interface ApiKey {
  id: string;
  provider: string;
  keyString: string;
  isActive: boolean;
  isExhausted: boolean;
  exhaustedAt: string | null;
  addedAt: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/api-keys");
    const data = await res.json();
    if (data.success) {
      setKeys(data.keys);
    }
    setLoading(false);
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey) return;
    const res = await fetch("/api/admin/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "gemini", keyString: newKey })
    });
    const data = await res.json();
    if (data.success) {
      setNewKey("");
      fetchKeys();
    } else {
      alert("Error: " + data.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this key?")) return;
    const res = await fetch(`/api/admin/api-keys?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchKeys();
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">محفظة مفاتيح Gemini (API Keys)</h1>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <form onSubmit={handleAddKey} className="flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label className="block text-sm font-medium text-gray-700">إضافة مفتاح جديد</label>
            <input
              type="password"
              placeholder="AIzaSy..."
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-left"
              dir="ltr"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 h-[42px]">
            إضافة المفتاح
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">جاري التحميل...</div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-gray-500">لا يوجد مفاتيح مسجلة. النظام يستخدم المفتاح الموجود في ملف .env حالياً.</div>
        ) : (
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">المزود</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">المفتاح</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">الحالة</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">وقت الإضافة</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map(k => (
                <tr key={k.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm capitalize">{k.provider}</td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-500 text-left" dir="ltr">
                    {k.keyString.substring(0, 8)}...{k.keyString.slice(-4)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {k.isExhausted ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        🔴 مستنفد (429)
                        {k.exhaustedAt && <span className="mr-1 text-[10px] text-red-600">منذ {new Date(k.exhaustedAt).toLocaleTimeString()}</span>}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        🟢 متاح
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(k.addedAt).toLocaleDateString("ar-EG")}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button onClick={() => handleDelete(k.id)} className="text-red-500 hover:text-red-700">
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
        <p><strong>ملاحظة هامة:</strong> النظام يقوم بالتبديل تلقائياً بين المفاتيح المتاحة (🟢 متاح). إذا حدث خطأ (429 Quota Exceeded)، سيتم تحويل حالة المفتاح إلى (🔴 مستنفد) ولن يُستخدم لمدة 24 ساعة، وسيقوم النظام باستخدام المفتاح المتاح التالي.</p>
      </div>
    </div>
  );
}

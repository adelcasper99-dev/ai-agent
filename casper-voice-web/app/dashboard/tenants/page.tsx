"use client";

import { useEffect, useState } from "react";

interface TenantRequest {
  id: string;
  telegramChatId: string;
  customerName: string;
  phoneNumber?: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export default function TenantsPage() {
  const [requests, setRequests] = useState<TenantRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/tenants/requests");
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
      }
    } catch (e) {
      console.error("فشل جلب طلبات التسجيل:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (requestId: string, action: "approve" | "reject") => {
    setProcessingId(requestId);
    try {
      const res = await fetch(`/api/tenants/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "casper-admin-secret-key",
        },
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchRequests();
      } else {
        alert(data.error || "فشل إجراء العملية");
      }
    } catch (e) {
      alert("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <p className="text-sm font-bold text-slate-500 py-10 text-center animate-pulse">جاري تحميل طلبات التفعيل والتسجيل الذاتي...</p>;

  return (
    <div className="space-y-6 max-w-4xl pb-10" dir="rtl">
      <div className="flex justify-between items-center bg-slate-900 text-white p-5 rounded-2xl shadow-lg border border-slate-800">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <span>🏢</span> إشعار وطلبات تفعيل الشركات والعملاء
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            إدارة طلبات التسجيل الذاتي القادمة عبر بوت التليجرام أو الدشبورد والموافقة الفورية عليها.
          </p>
        </div>
        <button
          onClick={fetchRequests}
          className="bg-slate-800 hover:bg-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-700 transition"
        >
          🔄 تحديث الطلبات
        </button>
      </div>

      <div className="space-y-3">
        {requests.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-2">
            <span className="text-3xl">📥</span>
            <h4 className="font-bold text-sm text-slate-700">لا توجد طلبات تسجيل معلقة حالياً</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              عندما يرسل عميل جديد كلمة <code className="bg-slate-200 px-1.5 py-0.5 rounded text-blue-800 font-mono">/start</code> للبوت على التليجرام، سيصلك إشعار فوري هنا وعلى حسابك بالتليجرام للموافقة.
            </p>
          </div>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 text-base">{req.customerName}</span>
                  <span
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                      req.status === "approved"
                        ? "bg-emerald-100 text-emerald-800"
                        : req.status === "rejected"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-800 animate-pulse"
                    }`}
                  >
                    {req.status === "approved"
                      ? "✅ مفعل ومكتمل"
                      : req.status === "rejected"
                      ? "❌ مرفوض"
                      : "⏳ في انتظار موافقتك"}
                  </span>
                </div>
                <div className="text-xs text-slate-600 flex items-center gap-4 font-mono dir-ltr">
                  <span>📱 {req.phoneNumber || "بدون رقم"}</span>
                  <span>💬 Telegram ID: {req.telegramChatId}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  تاريخ الطلب: {new Date(req.requestedAt).toLocaleString("ar-EG")}
                </p>
              </div>

              {req.status === "pending" && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleAction(req.id, "approve")}
                    disabled={processingId === req.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition disabled:opacity-50"
                  >
                    {processingId === req.id ? "جاري التفعيل..." : "✅ موافقة وتفعيل"}
                  </button>
                  <button
                    onClick={() => handleAction(req.id, "reject")}
                    disabled={processingId === req.id}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition disabled:opacity-50"
                  >
                    ❌ رفض
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

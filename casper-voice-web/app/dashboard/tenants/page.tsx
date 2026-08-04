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

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto pb-10 space-y-4" dir="rtl">
        {[1,2,3].map(i => (
          <div key={i} className="bento-card p-5 space-y-3">
            <div className="shimmer h-6 w-1/3 rounded-md" />
            <div className="shimmer h-4 w-1/4 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  const actionBtn = (variant: "brand" | "success" | "danger") => ({
    brand: { background: "var(--color-brand)", color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", border: "none" },
    success: { background: "var(--color-success)", color: "#fff", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)", border: "none" },
    danger: { background: "#fef2f2", color: "var(--color-danger)", border: "1px solid #fca5a5" } /* red-50 / red-300 */
  }[variant]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-10" dir="rtl">
      {/* Page Header Area with Pastel Gradient */}
      <div className="bento-card p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-pastel-purple border-0">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
            <span>🏢</span> إشعار وطلبات تفعيل الشركات والعملاء
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
            إدارة طلبات التسجيل الذاتي القادمة عبر بوت التليجرام أو الدشبورد والموافقة الفورية عليها.
          </p>
        </div>
        <button
          onClick={fetchRequests}
          className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold transition-all bg-white hover:bg-gray-50 shadow-sm"
          style={{
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          🔄 تحديث الطلبات
        </button>
      </div>

      <div className="space-y-4">
        {requests.length === 0 ? (
          <div className="nested-card p-10 text-center space-y-3 border-dashed" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
            <span className="text-3xl block">📥</span>
            <h4 className="font-bold text-sm" style={{ color: "var(--color-text-primary)" }}>لا توجد طلبات تسجيل معلقة حالياً</h4>
            <p className="text-xs max-w-md mx-auto leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              عندما يرسل عميل جديد كلمة <code className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-800">/start</code> للبوت على التليجرام، سيصلك إشعار فوري هنا وعلى حسابك بالتليجرام للموافقة.
            </p>
          </div>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              className="bento-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all hover:bg-gray-50"
            >
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <span className="font-bold text-base" style={{ color: "var(--color-text-primary)" }}>{req.customerName}</span>
                  <span
                    className="text-[10px] font-bold px-3 py-1 rounded-full w-fit"
                    style={{
                      background: req.status === "approved" 
                        ? "#ecfdf5" /* emerald-50 */
                        : req.status === "rejected" 
                        ? "#fef2f2" /* red-50 */
                        : "#fffbeb", /* amber-50 */
                      color: req.status === "approved"
                        ? "#059669" /* emerald-600 */
                        : req.status === "rejected"
                        ? "#dc2626" /* red-600 */
                        : "#d97706" /* amber-600 */
                    }}
                  >
                    {req.status === "approved"
                      ? "✅ مفعل ومكتمل"
                      : req.status === "rejected"
                      ? "❌ مرفوض"
                      : "⏳ في انتظار موافقتك"}
                  </span>
                </div>
                <div className="text-xs flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 font-mono dir-ltr" style={{ color: "var(--color-text-secondary)" }}>
                  <span className="bg-gray-100 px-2 py-1 rounded">📱 {req.phoneNumber || "بدون رقم"}</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">💬 Telegram ID: {req.telegramChatId}</span>
                </div>
                <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                  تاريخ الطلب: {new Date(req.requestedAt).toLocaleString("ar-EG")}
                </p>
              </div>

              {req.status === "pending" && (
                <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                  <button
                    onClick={() => handleAction(req.id, "approve")}
                    disabled={processingId === req.id}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs transition-all disabled:opacity-50"
                    style={actionBtn("success")}
                  >
                    {processingId === req.id ? "جاري التفعيل..." : "✅ موافقة وتفعيل"}
                  </button>
                  <button
                    onClick={() => handleAction(req.id, "reject")}
                    disabled={processingId === req.id}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs transition-all disabled:opacity-50"
                    style={actionBtn("danger")}
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

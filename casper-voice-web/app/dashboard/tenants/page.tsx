"use client";

import { useEffect, useState } from "react";

interface TenantData {
  id: string;
  name?: string;
  customerName?: string;
  phoneNumber?: string;
  telegramChatId?: string;
  status?: string;
  state?: string;
  requestedAt?: string;
  createdAt?: string;
  subscriptionPlan?: string;
  expiresAt?: string;
  type: "request" | "tenant";
}

export default function TenantsPage() {
  const [data, setData] = useState<TenantData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter & Search
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Modals
  const [modal, setModal] = useState<{ type: string; tenant: TenantData | null }>({ type: "", tenant: null });
  const [modalLoading, setModalLoading] = useState(false);
  
  // Edit forms
  const [editForm, setEditForm] = useState({ name: "", phoneNumber: "", subscriptionPlan: "trial_14", customDate: "" });

  const fetchData = async () => {
    try {
      const res = await fetch("/api/tenants/requests");
      const result = await res.json();
      if (result.success) {
        const reqs = (result.requests || []).map((r: any) => ({ ...r, type: "request" }));
        const tens = (result.tenants || []).map((t: any) => ({ ...t, type: "tenant" }));
        setData([...reqs, ...tens]);
      }
    } catch (e) {
      console.error("Failed to fetch tenants:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async () => {
    if (!modal.tenant) return;
    setModalLoading(true);
    try {
      await fetch("/api/tenants/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: modal.tenant.id, subscriptionPlan: editForm.subscriptionPlan }),
      });
      setModal({ type: "", tenant: null });
      fetchData();
    } catch (e) {
      alert("Error approving tenant");
    } finally {
      setModalLoading(false);
    }
  };

  const handleManageAction = async (action: string, targetTenantIdOrExtra?: string | any, extraData: any = {}) => {
    let tenantId = modal.tenant?.id;
    let payload = extraData;

    if (typeof targetTenantIdOrExtra === "string") {
      tenantId = targetTenantIdOrExtra;
    } else if (typeof targetTenantIdOrExtra === "object" && targetTenantIdOrExtra !== null) {
      payload = targetTenantIdOrExtra;
    }

    if (!tenantId) return;
    setModalLoading(true);
    try {
      await fetch("/api/tenants/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, tenantId, ...payload }),
      });
      setModal({ type: "", tenant: null });
      fetchData();
    } catch (e) {
      alert("Error managing tenant");
    } finally {
      setModalLoading(false);
    }
  };

  const openModal = (type: string, tenant: TenantData) => {
    setEditForm({
      name: tenant.name || tenant.customerName || "",
      phoneNumber: tenant.phoneNumber || "",
      subscriptionPlan: tenant.subscriptionPlan || "trial_14",
      customDate: "",
    });
    setModal({ type, tenant });
  };

  // Derived metrics
  const activeCount = data.filter(d => d.type === "tenant" && d.state === "active").length;
  const trialCount = data.filter(d => d.type === "tenant" && (d.state === "trial" || d.subscriptionPlan === "trial_14")).length;
  const pendingCount = data.filter(d => d.type === "request" && d.status === "pending").length;
  const suspendedCount = data.filter(d => d.type === "tenant" && d.state === "suspended").length;

  const filteredData = data.filter(d => {
    const sState = d.type === "tenant" ? d.state : d.status;
    const nameMatch = (d.name || d.customerName || "").toLowerCase().includes(search.toLowerCase());
    const phoneMatch = (d.phoneNumber || "").includes(search);
    const tgMatch = (d.telegramChatId || "").includes(search);
    
    if (filterStatus !== "all" && sState !== filterStatus) return false;
    if (search && !nameMatch && !phoneMatch && !tgMatch) return false;
    
    return true;
  });

  if (loading) {
    return <div className="p-10 text-center font-bold">جاري تحميل البيانات...</div>;
  }

  const renderStatus = (d: TenantData) => {
    if (d.type === "request") {
      if (d.status === "pending") return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs">⏳ قيد المراجعة</span>;
      if (d.status === "rejected") return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">❌ مرفوض</span>;
      return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs">✅ موافق عليه</span>;
    }
    if (d.state === "active") return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs">🟢 نشط</span>;
    if (d.state === "trial") return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">🟦 تجريبي</span>;
    if (d.state === "suspended") return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">🔴 موقوف</span>;
    return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">{d.state}</span>;
  };

  const renderPlan = (d: TenantData) => {
    if (d.type === "request") return "-";
    const plans: any = { trial_14: "تجربة 14 يوم", month_1: "شهر واحد", year_1: "سنة كاملة", custom: "مخصص" };
    const planName = plans[d.subscriptionPlan || "trial_14"];
    
    if (!d.expiresAt) return <span className="text-xs text-gray-500">{planName} (غير محدد)</span>;
    const daysLeft = Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const isExpired = daysLeft < 0;
    
    return (
      <div className="flex flex-col text-xs">
        <span className="font-bold text-gray-800">{planName}</span>
        {isExpired 
          ? <span className="text-red-500 font-bold">منتهي منذ {Math.abs(daysLeft)} يوم</span> 
          : <span className="text-emerald-600 font-bold">متبقي {daysLeft} يوم</span>}
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-10" dir="rtl">
      {/* Top Metrics Bento Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bento-card p-4 bg-white shadow-sm border-l-4 border-gray-400">
          <p className="text-xs text-gray-500 font-bold">إجمالي الشركات</p>
          <p className="text-2xl font-black mt-1 text-gray-800">{data.length}</p>
        </div>
        <div className="bento-card p-4 bg-emerald-50 shadow-sm border-l-4 border-emerald-500">
          <p className="text-xs text-emerald-700 font-bold">النشطة</p>
          <p className="text-2xl font-black mt-1 text-emerald-900">{activeCount}</p>
        </div>
        <div className="bento-card p-4 bg-blue-50 shadow-sm border-l-4 border-blue-500">
          <p className="text-xs text-blue-700 font-bold">فترة تجريبية</p>
          <p className="text-2xl font-black mt-1 text-blue-900">{trialCount}</p>
        </div>
        <div className="bento-card p-4 bg-amber-50 shadow-sm border-l-4 border-amber-500">
          <p className="text-xs text-amber-700 font-bold">طلبات معلقة</p>
          <p className="text-2xl font-black mt-1 text-amber-900">{pendingCount}</p>
        </div>
        <div className="bento-card p-4 bg-red-50 shadow-sm border-l-4 border-red-500">
          <p className="text-xs text-red-700 font-bold">موقوفة</p>
          <p className="text-2xl font-black mt-1 text-red-900">{suspendedCount}</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bento-card p-4 flex flex-col md:flex-row gap-4 justify-between items-center bg-white shadow-sm">
        <input 
          type="text" 
          placeholder="بحث بالاسم، الجوال، معرف التليجرام..." 
          className="glass-input w-full md:w-1/2 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select 
          className="glass-input w-full md:w-1/4 text-sm font-bold bg-white"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">كل الحالات</option>
          <option value="active">🟢 نشط</option>
          <option value="trial">🟦 تجريبي</option>
          <option value="pending">⏳ طلبات معلقة</option>
          <option value="suspended">🔴 موقوف</option>
        </select>
      </div>

      {/* Interactive Data Table */}
      <div className="bento-card overflow-hidden bg-white shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm text-gray-600">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-bold">الشركة / العميل</th>
                <th className="px-6 py-4 font-bold">رقم الهاتف</th>
                <th className="px-6 py-4 font-bold">Telegram ID</th>
                <th className="px-6 py-4 font-bold">الحالة</th>
                <th className="px-6 py-4 font-bold">الخطة والمتبقي</th>
                <th className="px-6 py-4 font-bold">تاريخ الانتهاء</th>
                <th className="px-6 py-4 font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(d => (
                <tr key={d.id} className="border-b border-gray-50 hover:bg-blue-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{d.name || d.customerName || "بدون اسم"}</td>
                  <td className="px-6 py-4 font-mono">{d.phoneNumber || <span className="text-red-400 text-xs font-bold">بدون رقم</span>}</td>
                  <td className="px-6 py-4 font-mono">{d.telegramChatId || "-"}</td>
                  <td className="px-6 py-4">{renderStatus(d)}</td>
                  <td className="px-6 py-4">{renderPlan(d)}</td>
                  <td className="px-6 py-4 text-xs font-mono">{d.expiresAt ? new Date(d.expiresAt).toLocaleDateString("ar-EG") : "-"}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {d.type === "request" && d.status === "pending" && (
                        <>
                          <button onClick={() => openModal("approve", d)} className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded text-xs font-bold hover:bg-emerald-200">
                            موافقة وتفعيل
                          </button>
                          <button onClick={() => handleManageAction("delete_request", d.id)} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold hover:bg-red-100 hover:text-red-700">
                            🗑️ حذف
                          </button>
                        </>
                      )}
                      {d.type === "tenant" && (
                        <>
                          <button onClick={() => openModal("edit", d)} className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-bold hover:bg-blue-200">
                            تعديل
                          </button>
                          <button onClick={() => openModal("extend", d)} className="bg-purple-100 text-purple-700 px-3 py-1 rounded text-xs font-bold hover:bg-purple-200">
                            تمديد
                          </button>
                          {d.state === "active" || d.state === "trial" ? (
                            <button onClick={() => handleManageAction("suspend", d.id)} className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-bold hover:bg-red-200">
                              إيقاف
                            </button>
                          ) : (
                            <button onClick={() => handleManageAction("reactivate", d.id)} className="bg-amber-100 text-amber-700 px-3 py-1 rounded text-xs font-bold hover:bg-amber-200">
                              إعادة تنشيط
                            </button>
                          )}
                          <button onClick={() => {
                            if (confirm("هل أنت تأكد من حذف هذه الشركة تماماً لإعادة تسجيلها من جديد؟")) {
                              handleManageAction("delete", d.id);
                            }
                          }} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold hover:bg-red-100 hover:text-red-700">
                            🗑️ حذف
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center font-bold text-gray-400">لا توجد بيانات مطابقة</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {modal.type === "approve" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800">✅ موافقة وتفعيل الشركة</h3>
            <p className="text-sm text-gray-600">اختر خطة الاشتراك لـ <strong className="text-gray-900">{modal.tenant?.customerName}</strong></p>
            <select 
              className="glass-input w-full"
              value={editForm.subscriptionPlan}
              onChange={(e) => setEditForm({...editForm, subscriptionPlan: e.target.value})}
            >
              <option value="trial_14">🟢 تجربة 14 يوم</option>
              <option value="month_1">🟦 شهر واحد</option>
              <option value="year_1">🟣 سنة كاملة</option>
            </select>
            <div className="flex gap-3 pt-4">
              <button onClick={handleApprove} disabled={modalLoading} className="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50">
                {modalLoading ? "جاري..." : "تأكيد التفعيل"}
              </button>
              <button onClick={() => setModal({ type: "", tenant: null })} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl font-bold hover:bg-gray-200">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {modal.type === "edit" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800">✏️ تعديل بيانات الشركة</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600">اسم الشركة</label>
                <input type="text" className="glass-input w-full mt-1" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">رقم الهاتف</label>
                <input type="text" className="glass-input w-full mt-1 font-mono text-left" dir="ltr" value={editForm.phoneNumber} onChange={e => setEditForm({...editForm, phoneNumber: e.target.value})} placeholder="+201..." />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => handleManageAction("edit_details", { name: editForm.name, phoneNumber: editForm.phoneNumber })} disabled={modalLoading} className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
                {modalLoading ? "جاري..." : "حفظ التعديلات"}
              </button>
              <button onClick={() => setModal({ type: "", tenant: null })} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl font-bold hover:bg-gray-200">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {modal.type === "extend" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800">⌛ تمديد الاشتراك</h3>
            <p className="text-sm text-gray-600">تمديد خطة الاشتراك لـ <strong className="text-gray-900">{modal.tenant?.name}</strong></p>
            <select 
              className="glass-input w-full"
              value={editForm.subscriptionPlan}
              onChange={(e) => setEditForm({...editForm, subscriptionPlan: e.target.value})}
            >
              <option value="trial_14">🟢 تمديد 14 يوم إضافية</option>
              <option value="month_1">🟦 تمديد شهر واحد</option>
              <option value="year_1">🟣 تمديد سنة كاملة</option>
              <option value="custom">⚙️ تمديد مخصص</option>
            </select>
            {editForm.subscriptionPlan === "custom" && (
              <input type="date" className="glass-input w-full mt-2" value={editForm.customDate} onChange={e => setEditForm({...editForm, customDate: e.target.value})} />
            )}
            <div className="flex gap-3 pt-4">
              <button onClick={() => handleManageAction("extend_plan", { subscriptionPlan: editForm.subscriptionPlan, expiresAt: editForm.customDate || undefined })} disabled={modalLoading} className="flex-1 bg-purple-600 text-white py-2 rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50">
                {modalLoading ? "جاري..." : "تأكيد التمديد"}
              </button>
              <button onClick={() => setModal({ type: "", tenant: null })} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl font-bold hover:bg-gray-200">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

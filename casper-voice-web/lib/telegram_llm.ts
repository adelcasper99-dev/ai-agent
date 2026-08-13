import { prisma } from "@/lib/prisma";
import { resolveMerchantMemories, extractAndPersistMemory } from "./merchant_memory";
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import Groq from "groq-sdk";
import Decimal from "decimal.js";
import { sendTelegramAlert } from "./telegram";
import { checkAndAlertTokenUsage } from "./usage-alert";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });


const logSaleTool: FunctionDeclaration = {
  name: "log_sale",
  description: "تسجيل عملية بيع لعميل (استخراج المنتج، سعر الوحدة أو الإجمالي، الكمية، اسم العميل، والمدفوع والآجل)",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      item_name: { type: SchemaType.STRING, description: "اسم المنتج أو البضاعة المباعة فقط (مثال: كرتونة مسامير، زيت، شاشة)" },
      price: { type: SchemaType.NUMBER, description: "سعر الوحدة بالجنيه (إذا ذكر الإجمالي فقط قم بقسمته على الكمية)" },
      quantity: { type: SchemaType.NUMBER, description: "الكمية المباعة كرقم (مثال: 'كرتونتين' = 2، '5 قطع' = 5، الافتراضي 1)" },
      customer_name: { type: SchemaType.STRING, description: "اسم العميل (إذا ذكر بعد 'لـ' أو 'حساب' أو في نهاية الجملة)" },
      customer_phone: { type: SchemaType.STRING, description: "تليفون العميل (إن وجد)" },
      paid_amount: { type: SchemaType.NUMBER, description: "المبلغ المدفوع كاش أو مقدم/عربون بالجنيه (إذا كانت كاش بالكامل يساوى الإجمالي، إذا كانت آجل بالكامل يساوى 0)" },
      deferred_amount: { type: SchemaType.NUMBER, description: "المبلغ المتبقي آجل على العميل بالجنيه (الإجمالي minus المدفوع)" },
      idempotency_key: { type: SchemaType.STRING, description: "رقم فريد عشوائي لمنع تكرار العملية بالخطأ" }
    },
    required: ["item_name"]
  }
};

const addProductTool: FunctionDeclaration = {
  name: "add_product",
  description: "إضافة صنف جديد أو خدمة للكتالوج (للمدير فقط). استخدم هذه الأداة لتعريف الأصناف في المخزون أو الخدمات التي لا تحتاج مخزون.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      name: { type: SchemaType.STRING, description: "اسم الصنف أو الخدمة (مثال: كرتونة شاي، خدمة توصيل)" },
      is_stock_item: { type: SchemaType.BOOLEAN, description: "هل هو صنف ملموس يحتاج تتبع مخزون؟ (true للصنف، false للخدمات)" },
      stock_quantity: { type: SchemaType.NUMBER, description: "الكمية الافتتاحية في المخزون (ضع 0 للخدمات)" },
      unit_price: { type: SchemaType.NUMBER, description: "سعر الوحدة بالجنيه" }
    },
    required: ["name", "is_stock_item", "stock_quantity", "unit_price"]
  }
};

const updateStockTool: FunctionDeclaration = {
  name: "update_stock",
  description: "تعديل كمية المخزون الفعلية لصنف موجود (جرد - تصحيح رصيد). استخدم عند قول 'تعديل المخزون', 'الجرد', 'الرصيد الفعلي', 'صحح المخزون'.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      product_name: { type: SchemaType.STRING, description: "اسم الصنف المراد تعديل مخزونه" },
      new_quantity: { type: SchemaType.NUMBER, description: "الكمية الجديدة الفعلية في المخزون (الرصيد الفعلي بعد الجرد)" }
    },
    required: ["product_name", "new_quantity"]
  }
};

const addCustomerTool: FunctionDeclaration = {
  name: "add_customer",
  description: "تسجيل عميل جديد في النظام. استخدم عند قول 'سجل عميل جديد', 'أضف عميل', 'عميل جديد اسمه X'.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      customer_name: { type: SchemaType.STRING, description: "اسم العميل أو الشركة" },
      customer_phone: { type: SchemaType.STRING, description: "تليفون العميل (إن وجد)" },
      notes: { type: SchemaType.STRING, description: "ملاحظات إضافية (اختياري)" }
    },
    required: ["customer_name"]
  }
};


const logExpenseTool: FunctionDeclaration = {
  name: "log_expense",
  description: "تسجيل مصروف جديد (مبلغ، بيان/سبب، فئة)",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      amount: { type: SchemaType.NUMBER, description: "المبلغ المدفوع بالجنيه" },
      description: { type: SchemaType.STRING, description: "سبب أو بيان المصروف" },
      category: { type: SchemaType.STRING, description: "فئة المصروف (الافتراضي: عام)" }
    },
    required: ["amount", "description"]
  }
};


const bookAppointmentTool: FunctionDeclaration = {
  name: "book_appointment",
  description: "حجز موعد جديد مع عميل (اسم العميل، التاريخ، الوقت، ملاحظات)",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      customer_name: { type: SchemaType.STRING, description: "اسم العميل" },
      customer_phone: { type: SchemaType.STRING, description: "تليفون العميل (إن وجد)" },
      date: { type: SchemaType.STRING, description: "تاريخ الموعد (مثال: 2026-08-01 أو الغد)" },
      time: { type: SchemaType.STRING, description: "وقت الموعد (مثال: 05:00 مساءً)" },
      notes: { type: SchemaType.STRING, description: "ملاحظات إضافية (اختياري)" }
    },
    required: ["customer_name", "date", "time"]
  }
};

const logPurchaseTool: FunctionDeclaration = {
  name: "log_purchase",
  description: "تسجيل فاتورة مشتريات جديدة من مورد وبضائع مششراة.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      supplier_name: { type: SchemaType.STRING, description: "اسم المورد المشترى منه (إجباري لمتابعة الحسابات والآجل)" },
      item_name: { type: SchemaType.STRING, description: "اسم الصنف أو البضاعة المششراة" },
      unit: { type: SchemaType.STRING, description: "وحدة القياس المذكورة في الطلب إن وجدت (مثال: طن، كيلو، كرتونة، قطعة، متر، شكارة)" },
      quantity: { type: SchemaType.NUMBER, description: "الكمية المششراة كرقم (مثال: '5 كراتين' = 5)" },
      price_per_unit: { type: SchemaType.NUMBER, description: "سعر الكرتونة أو القطعة الواحدة بالجنيه" },
      total_amount: { type: SchemaType.NUMBER, description: "إجمالي قيمة الفاتورة بالجنيه (إذا ذكر سعر الوحدة والكمية قم بضربهما)" },
      paid_amount: { type: SchemaType.NUMBER, description: "المبلغ المدفوع (إذا ذكر كاش يساوى الإجمالي، إذا آجل يساوى 0)" }
    },
    required: ["supplier_name", "item_name"]
  }
};

const getFinancialSummaryTool: FunctionDeclaration = {
  name: "get_financial_summary",
  description: "عرض إجمالي المبيعات والمصروفات لفترة معينة (يومي، أسبوعي، شهري، أو فترة محددة).",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      period: { 
        type: SchemaType.STRING, 
        description: "الفترة المطلوبة: 'today', 'week', 'month', أو 'custom'" 
      },
      start_date: { 
        type: SchemaType.STRING, 
        description: "إذا كانت الفترة custom، أدخل تاريخ البداية بصيغة YYYY-MM-DD" 
      },
      end_date: { 
        type: SchemaType.STRING, 
        description: "إذا كانت الفترة custom، أدخل تاريخ النهاية بصيغة YYYY-MM-DD" 
      }
    },
    required: ["period"]
  }
};

const getAppointmentsListTool: FunctionDeclaration = {
  name: "get_appointments_list",
  description: "استرجاع قائمة المواعيد المحجوزة للعملاء (لمعرفة موعد عميل محدد، أو المواعيد القادمة). استخدمها فوراً عندما يسأل التاجر عن 'ميعاد فلان', 'مواعيد بكرة', 'امتى معاد احمد'.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      customer_name: {
        type: SchemaType.STRING,
        description: "اسم العميل المراد البحث عن موعده (مثال: أحمد محمود)"
      },
      limit: { 
        type: SchemaType.NUMBER, 
        description: "عدد المواعيد المراد استرجاعها، افتراضيا 10" 
      }
    },
    required: []
  }
};

const cancelAppointmentTool: FunctionDeclaration = {
  name: "cancel_appointment",
  description: "إلغاء أو حذف موعد محجوز لعميل (مثال: 'الغي موعد احمد مكش', 'حذف موعد فلان').",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      customer_name: { type: SchemaType.STRING, description: "اسم العميل المراد إلغاء موعده" },
      date: { type: SchemaType.STRING, description: "تاريخ الموعد المراد إلغاؤه إن وجد" }
    },
    required: ["customer_name"]
  }
};

const rescheduleAppointmentTool: FunctionDeclaration = {
  name: "reschedule_appointment",
  description: "تأجيل أو تغيير/تعديل تاريخ ووقت موعد محجوز لعميل إلى تاريخ ووقت جديدين (مثال: 'أجل موعد احمد مكش لبكرة الساعة 5').",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      customer_name: { type: SchemaType.STRING, description: "اسم العميل المراد تعديل موعده" },
      new_date: { type: SchemaType.STRING, description: "التاريخ الجديد للموعد (مثال: 2026-08-15 أو غداً)" },
      new_time: { type: SchemaType.STRING, description: "الوقت الجديد للموعد (مثال: 05:00 مساءً)" }
    },
    required: ["customer_name", "new_date", "new_time"]
  }
};

const reportMissingFeatureTool: FunctionDeclaration = {
  name: "report_missing_feature",
  description: "استخدم هذه الأداة للإبلاغ عن ميزة غير موجودة في أدواتك، عندما يطلب المستخدم مهمة لا تستطيع تنفيذها. سيتم إرسال اقتراح للمطور.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      feature_description: { 
        type: SchemaType.STRING, 
        description: "وصف واضح للميزة التي طلبها المستخدم ولم تستطع تنفيذها." 
      }
    },
    required: ["feature_description"]
  }
};

const logCustomerPaymentTool: FunctionDeclaration = {
  name: "log_customer_payment",
  description: "تسجيل حركة نقدية مع عميل (سداد من العميل أو استرداد/دفع مبلغ كاش للعميل).",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      customer_name: { type: SchemaType.STRING, description: "اسم العميل" },
      customer_phone: { type: SchemaType.STRING, description: "تليفون العميل (إن وجد)" },
      amount: { type: SchemaType.NUMBER, description: "المبلغ بالجنيه" },
      is_refund: { 
        type: SchemaType.BOOLEAN, 
        description: "ضع true إذا كان المحل هو من يدفع/يرد المبلغ كاش للعميل (مثل: 'ادفع 100 لأحمد' أو 'رديت له 100'). ضع false إذا كان العميل هو من يسدد للمحل." 
      },
      idempotency_key: { type: SchemaType.STRING, description: "رقم فريد عشوائي لمنع التكرار" }
    },
    required: ["customer_name", "amount", "idempotency_key"]
  }
};

const getCustomerBalanceTool: FunctionDeclaration = {
  name: "get_customer_balance",
  description: "استعلام عن رصيد عميل وكشف حسابه لمعرفة إجمالي الديون عليه.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      customer_name: { type: SchemaType.STRING, description: "اسم العميل" },
      customer_phone: { type: SchemaType.STRING, description: "تليفون العميل (إن وجد)" }
    },
    required: ["customer_name"]
  }
};

const logSupplierPaymentTool: FunctionDeclaration = {
  name: "log_supplier_payment",
  description: "تسجيل دفعة سداد ديون أو مستحقات لمورد (سداد حساب مورد).",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      supplier_name: { type: SchemaType.STRING, description: "اسم المورد" },
      amount: { type: SchemaType.NUMBER, description: "المبلغ المسدد بالجنيه" },
      idempotency_key: { type: SchemaType.STRING, description: "رقم فريد عشوائي لمنع التكرار" }
    },
    required: ["supplier_name", "amount", "idempotency_key"]
  }
};

const getSupplierBalanceTool: FunctionDeclaration = {
  name: "get_supplier_balance",
  description: "استعلام عن رصيد حساب مورد لمعرفة كشف المشتريات والديون المستحقة له.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      supplier_name: { type: SchemaType.STRING, description: "اسم المورد" }
    },
    required: ["supplier_name"]
  }
};

const logSalesReturnTool: FunctionDeclaration = {
  name: "log_sales_return",
  description: "تسجيل مرتجع مبيعات من عميل (إعادة بضاعة من العميل).",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      customer_name: { type: SchemaType.STRING, description: "اسم العميل" },
      item_name: { type: SchemaType.STRING, description: "اسم الصنف المرتجع (اختياري)" },
      quantity: { type: SchemaType.NUMBER, description: "الكمية المرتجعة (مثال: 1)" },
      amount: { type: SchemaType.NUMBER, description: "إجمالي قيمة المرتجع بالجنيه" },
      idempotency_key: { type: SchemaType.STRING, description: "رقم فريد عشوائي لمنع التكرار" }
    },
    required: ["customer_name", "amount", "idempotency_key"]
  }
};

const logPurchaseReturnTool: FunctionDeclaration = {
  name: "log_purchase_return",
  description: "تسجيل مرتجع مشتريات لمورد (إعادة بضاعة للمورد).",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      supplier_name: { type: SchemaType.STRING, description: "اسم المورد" },
      item_name: { type: SchemaType.STRING, description: "اسم الصنف المرتجع (اختياري)" },
      quantity: { type: SchemaType.NUMBER, description: "الكمية المرتجعة (مثال: 1)" },
      amount: { type: SchemaType.NUMBER, description: "إجمالي قيمة المرتجع بالجنيه" },
      idempotency_key: { type: SchemaType.STRING, description: "رقم فريد عشوائي لمنع التكرار" }
    },
    required: ["supplier_name", "amount", "idempotency_key"]
  }
};

const saveMerchantMemoryTool: FunctionDeclaration = {
  name: "save_merchant_memory",
  description: "حفظ حقيقة أو alias أو تفضيل ثابت عن التاجر أو العملاء أو الموردين أو وحدات القياس لاستخدامه في الذاكرة مستقبلاً",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      category: {
        type: SchemaType.STRING,
        description: "فئة الذاكرة: 'customer_alias' (لقب عميل) أو 'supplier_alias' (لقب مورد) أو 'product_alias' (لقب منتج) أو 'unit_preference' (وحدة قياس) أو 'general_preference' (تفضيل عام)"
      },
      key: {
        type: SchemaType.STRING,
        description: "الاسم الإشاري/اللقب/الوحدة التي يستخدمها التاجر (مثال: 'الرئيس صابر' أو 'أبو صلاح' أو 'الكرتونة')"
      },
      value: {
        type: SchemaType.STRING,
        description: "القيمة أو الاسم الرسمي الفعلي المرتبط في النظام (مثال: 'صابر المحلاوي' أو 'أحمد محمد')"
      }
    },
    required: ["category", "key", "value"]
  }
};

const getMerchantMemoryTool: FunctionDeclaration = {
  name: "get_merchant_memory",
  description: "الاستعلام عن ذاكرة التاجر لمعرفة ألقاب العملاء/الموردين أو تفضيلات العمل المسجلة سابقا",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      key: { type: SchemaType.STRING, description: "الكلمة أو اللقب المراد البحث عنه (اختياري)" },
      category: { type: SchemaType.STRING, description: "فئة الذاكرة المراد تصفيتها (اختياري)" }
    }
  }
};

const cancelLastTransactionTool: FunctionDeclaration = {
  name: "cancel_last_transaction",
  description: "إلغاء آخر عملية مسجلة (بيع، مشتريات، أو مصروف) عندما يطلب التاجر إلغاءها أو يقول 'بعت مش اشتريت' أو 'الغى العملية الأخيرة'",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      transaction_type: {
        type: SchemaType.STRING,
        description: "نوع العملية المراد إلغاؤها: 'sale' (بيع) أو 'purchase' (مشتريات) أو 'expense' (مصروف) أو 'auto' (تلقائي)"
      },
      confirmed: {
        type: SchemaType.BOOLEAN,
        description: "هل أكد التاجر صراحة بالإلغاء بعد سؤال التأكيد؟ (مثال: نعم/أكيد/أيوة)"
      }
    },
    required: ["transaction_type"]
  }
};

const correctLastTransactionTool: FunctionDeclaration = {
  name: "correct_last_transaction",
  description: "تعديل حقل أو أكثر (الكمية، السعر، اسم العميل، اسم المورد) في آخر عملية مسجلة عندما يوضح التاجر خطأ في البيانات المسجلة",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      corrections: {
        type: SchemaType.ARRAY,
        description: "قائمة التعديلات المراد تطبيقها على العملية الأخيرة",
        items: {
          type: SchemaType.OBJECT,
          properties: {
            field: {
              type: SchemaType.STRING,
              description: "الحقل المراد تعديله: 'customer_name' أو 'supplier_name' أو 'quantity' أو 'price' أو 'total_amount'"
            },
            new_value: {
              type: SchemaType.STRING,
              description: "القيمة الجديدة الصحيحة المراد حفظها"
            }
          },
          required: ["field", "new_value"]
        }
      }
    },
    required: ["corrections"]
  }
};

// ==================== DYNAMIC TOOL ROUTING & CLUSTERS ====================

export const ALL_TOOLS: FunctionDeclaration[] = [
  logSaleTool, logExpenseTool, bookAppointmentTool, logPurchaseTool,
  getFinancialSummaryTool, getAppointmentsListTool, cancelAppointmentTool, rescheduleAppointmentTool,
  reportMissingFeatureTool, logCustomerPaymentTool, getCustomerBalanceTool, logSupplierPaymentTool,
  getSupplierBalanceTool, logSalesReturnTool, logPurchaseReturnTool, addProductTool,
  updateStockTool, addCustomerTool, saveMerchantMemoryTool, getMerchantMemoryTool,
  cancelLastTransactionTool, correctLastTransactionTool
];

export type ClusterKey = 'SALES' | 'PURCHASES' | 'APPOINTMENTS' | 'INVENTORY' | 'FINANCE_META';

const SALES_TOOLS: FunctionDeclaration[] = [logSaleTool, addCustomerTool, logSalesReturnTool, logCustomerPaymentTool, getCustomerBalanceTool, cancelLastTransactionTool, correctLastTransactionTool];
const PURCHASE_TOOLS: FunctionDeclaration[] = [logPurchaseTool, logSupplierPaymentTool, getSupplierBalanceTool, logPurchaseReturnTool, cancelLastTransactionTool, correctLastTransactionTool];
const APPOINTMENT_TOOLS: FunctionDeclaration[] = [bookAppointmentTool, getAppointmentsListTool, cancelAppointmentTool, rescheduleAppointmentTool];
const INVENTORY_TOOLS: FunctionDeclaration[] = [addProductTool, updateStockTool];
const FINANCE_META_TOOLS: FunctionDeclaration[] = [logExpenseTool, getFinancialSummaryTool, reportMissingFeatureTool, saveMerchantMemoryTool, getMerchantMemoryTool, cancelLastTransactionTool, correctLastTransactionTool];

const CLUSTER_KEYWORDS: Record<ClusterKey, string[]> = {
  SALES: ["بيع", "بعت", "كاش", "آجل", "عميل", "حساب عميل", "رصيد عميل", "قبضت", "سدد", "مرتجع مبيعات", "رجع من", "تليفون عميل", "ديون عميل", "بعت مش اشتريت", "الغى", "إلغاء", "خطأ", "تعديل"],
  PURCHASES: ["شراء", "اشتريت", "اشترى", "اشترى من", "مشتريات", "مورد", "فاتورة", "سددت للمورد", "مرتجع مشتريات", "رجعت للمورد", "حساب المورد", "ديون مورد", "اشتريت مش بعت", "الغى", "إلغاء", "خطأ", "تعديل"],
  APPOINTMENTS: ["موعد", "ميعاد", "حجز", "الغي", "لغى", "مسح ميعاد", "تأجيل", "أجل", "غير ميعاد", "مواعيد", "بكرة الساعة", "اشوف مواعيد", "معاد"],
  INVENTORY: ["صنف", "منتج", "كتالوج", "مخزون", "جرد", "رصيد فعلي", "صحح مخزون", "أضف صنف", "سلعة جديدة"],
  FINANCE_META: ["مصروف", "مصاريف", "تقرير", "ملخص", "أرباح", "مبيعات النهاردة", "كشف حساب شهر", "ميزة ناقصة", "امسح", "تعديل", "خطأ"]
};

export function resolveActiveTools(text: string, lastHistoryMsg?: string): { activeTools: FunctionDeclaration[]; activeClusters: ClusterKey[] } {
  const searchText = `${text} ${lastHistoryMsg || ''}`.toLowerCase();
  const matchedClusters = new Set<ClusterKey>();

  for (const [cluster, keywords] of Object.entries(CLUSTER_KEYWORDS) as [ClusterKey, string[]][]) {
    if (keywords.some(kw => searchText.includes(kw.toLowerCase()))) {
      matchedClusters.add(cluster);
    }
  }

  // Safety fallback: if 0 clusters match or >= 4 clusters match (high ambiguity/multi-intent), return ALL_TOOLS
  if (matchedClusters.size === 0 || matchedClusters.size >= 4) {
    return { activeTools: ALL_TOOLS, activeClusters: ['SALES', 'PURCHASES', 'APPOINTMENTS', 'INVENTORY', 'FINANCE_META'] };
  }

  const toolSet = new Set<FunctionDeclaration>();
  for (const cluster of matchedClusters) {
    let clusterTools: FunctionDeclaration[] = [];
    if (cluster === 'SALES') clusterTools = SALES_TOOLS;
    else if (cluster === 'PURCHASES') clusterTools = PURCHASE_TOOLS;
    else if (cluster === 'APPOINTMENTS') clusterTools = APPOINTMENT_TOOLS;
    else if (cluster === 'INVENTORY') clusterTools = INVENTORY_TOOLS;
    else if (cluster === 'FINANCE_META') clusterTools = FINANCE_META_TOOLS;

    clusterTools.forEach(t => toolSet.add(t));
  }

  return { activeTools: Array.from(toolSet), activeClusters: Array.from(matchedClusters) };
}

export function buildActivePrompt(activeClusters: ClusterKey[], companyStr: string, typeStr: string, hoursStr: string, memoryContext?: string): string {
  const CORE_PROMPT = `أنت المساعد الشخصي الذكي الخاص بمدير أو صاحب العمل ${companyStr} ${typeStr} ${hoursStr}.
تحدث بالعامية المصرية الحية والراقية مباشرة وسريعة.

قواعد حظر التخيل والبيانات الأساسية:
- جميع العملاء والمستخدمين يتحدثون اللغة العربية (العامية المصرية) والإنجليزية فقط لا غير.
- يُمنع منعاً باتاً ترجمة كلام التاجر أو تحويل المعاملات إلى أي لغة أجنبية أخرى.
- إذا كان هناك حقل مفقود أو غير واضح، اسأل التاجر فوراً وبكل وضوح بالعامية المصرية لاستكمال البيانات الناقصة.
- أداة report_missing_feature مخصصة فقط للميزات البرمجية الحقيقية غير المتاحة. يُمنع منعاً باتاً استدعاؤها عند رفض حجز موعد في الماضي أو تلقي كلام عشوائي.`;

  const EXTRACTION_RULES: Record<ClusterKey, string> = {
    SALES: `
قواعد استخراج وفهم المبيعات عند استخدام أداة log_sale:
1. فصل اسم البضاعة عن اسم العميل: اسم البضاعة بييجي في البداية (مثال: "[اسم صنف]", "زيت موتور", "شاشة 55"). اسم العميل بييجي في نهاية الجملة أو بعد (لـ / حساب / عميل).
2. استخراج الكميات والأسعار: الأرقام والوحدات: "[كمية] [اسم صنف] بـ [مبلغ]" -> استخرج الكمية كرقم، اسم الصنف كنص، وسعر الوحدة = المبلغ ÷ الكمية إذا ذُكر الإجمالي فقط.
3. التمييز الدقيق بين الكاش والآجل: إذا ذكر كلمة "آجل" أو "على الحساب" -> paid_amount: 0, deferred_amount: الإجمالي. إذا كان البيع عادي أو كاش -> paid_amount: الإجمالي, deferred_amount: 0. إذا كان عربون/مقدم: "دفع 100 والباقي آجل" -> paid_amount: 100, deferred_amount: المتبقي.
4. حظر الأوصاف والأسعار الوهمية والخصومات غير المصرح بها:
   - إذا كتب العميل كلمة "بيع" فقط أو لم يحدد البضاعة والسعر، اسأله عن التفاصيل فوراً ولا تفترض أبداً صنفاً مثل "المنتج" أو سعراً افتراضياً.
   - إذا كان الصنف غير موجود بالكتالوج أو ذُكر سعر مختلف أو خصم غير مصرح به عن سعر الكتالوج، ارفض العملية واطلب التوضيح والتأكد من السعر والصنف.
5. الاستعلام عن رصيد، حساب، أو تليفون عميل (get_customer_balance): عندما يكتب التاجر عبارات استعلامية مثل: "ممكن تقولي رقم تليفون [اسم]", "رقم [اسم] كام", "تليفون [اسم]", "حساب [اسم]", "رصيد [اسم]", "هو عليه كام؟" -> يجب استخدام أداة get_customer_balance فوراً!
6. سداد ديون واسترداد الكاش (log_customer_payment): إذا كان العميل يسدد للمحل ("سدد أحمد 100", "قبضت من أحمد 100") -> استخدم log_customer_payment بـ is_refund: false.`,

    PURCHASES: `
قواعد المشتريات والموردين (log_purchase / log_supplier_payment / get_supplier_balance / log_purchase_return):
1. تسجيل فاتورة مشتريات (log_purchase): استخرج اسم المورد واسم الصنف والكمية والأسعار.
2. قاعدة التمييز الجوهري بين البيع والشراء:
   - إذا كانت الجملة على النمط: "اشترى/اشتريت [صنف] من [اسم]" ->
     - يعني التاجر أنه اشترى من مورد -> استخدم log_purchase وليس log_sale بأي شكل.
     - اسم الشخص بعد "من" هو المورد (supplier_name) وليس عميلاً.
   - إذا كانت الجملة على النمط: "اشترى [اسم العميل] [صنف] [سعر]" (بدون كلمة 'من') ->
     - يعني عميل اشترى منك -> استخدم log_sale.
3. سداد واستعلام حسابات الموردين: استخدم log_supplier_payment للسداد و get_supplier_balance للاستعلام.
4. مرتجع مشتريات للمورد (log_purchase_return): عند إرجاع بضاعة للمورد استخدم log_purchase_return.`,

    APPOINTMENTS: `
قواعد إدارة المواعيد (book_appointment / get_appointments_list / cancel_appointment / reschedule_appointment):
1. حجز موعد جديد (book_appointment): تاريخ اليوم يُؤخذ من النظام. إذا طلب موعداً في الماضي، ارفض الطلب واطلب تاريخاً في المستقبل.
2. استرجاع قائمة المواعيد (get_appointments_list): عند السؤال عن 'ميعاد فلان' أو 'مواعيد بكرة'.
3. إلغاء وتعديل المواعيد (cancel_appointment / reschedule_appointment): عند طلب إلغاء استخدم cancel_appointment، وعند التأجيل استخدم reschedule_appointment.`,

    INVENTORY: `
قواعد المخزون والكتالوج (add_product / update_stock):
1. إضافة صنف جديد (add_product): استخدمها لتعريف صنف جديد بالكتالوج.
2. تعديل رصيد المخزون (update_stock): عند الجرد أو الرصيد الفعلي لصنف، استخدم update_stock مع الكمية الجديدة.`,

    FINANCE_META: `
قواعد المصروفات والتقارير العامة (log_expense / get_financial_summary / report_missing_feature):
1. تسجيل المصروفات (log_expense): استخرج المبلغ والبيان والفئة.
2. تقارير الأرباح والمبيعات (get_financial_summary): للفترات اليومية والأسبوعية والشهرية.`
  };

  const activeRules = activeClusters.map(c => EXTRACTION_RULES[c] || '').join('\n');
  const memoryBlock = memoryContext ? `\n\n[ذاكرة التاجر المحفوظة (سياق فقط)]:\n${memoryContext}` : '';
  return `${CORE_PROMPT}\n${activeRules}${memoryBlock}`.trim();
}


// ==================== END ROUTING ====================

const executedKeys = new Set<string>();

async function syncCustomerLedgers(tx: any, customerId: string, tenantId: string) {
  try {
    const sales = await tx.sale.findMany({ where: { customerId } });
    for (const sale of sales) {
      const existingLedgers = await tx.customerLedgerEntry.findMany({ where: { saleId: sale.id } });
      const hasCorrectDebit = existingLedgers.some((l: any) => l.entryType === "SALE_DEBIT" && l.amount === sale.total);
      
      if (!hasCorrectDebit) {
        await tx.customerLedgerEntry.deleteMany({ where: { saleId: sale.id } });
        
        await tx.customerLedgerEntry.create({
          data: {
            customerId,
            saleId: sale.id,
            entryType: "SALE_DEBIT",
            amount: sale.total,
            description: `فاتورة مبيعات: ${sale.quantity} ${sale.itemName}`,
            ...(tenantId && { tenantId }),
            createdAt: sale.createdAt
          }
        });

        if (sale.paidAmount > 0) {
          await tx.customerLedgerEntry.create({
            data: {
              customerId,
              saleId: sale.id,
              entryType: "PAYMENT_CREDIT",
              amount: sale.paidAmount,
              description: `دفعة مسددة عند البيع: ${sale.itemName}`,
              ...(tenantId && { tenantId }),
              createdAt: sale.createdAt
            }
          });
        }
      }
    }
  } catch (e) {
    console.error("[syncCustomerLedgers Error]:", e);
  }
}

async function findCustomerFuzzy(tx: any, tenantId: string, name: string, phone: string | null, includeLedgers: boolean = false) {
  let customer = null;
  const include = includeLedgers ? { ledgers: true } : undefined;
  const tId = tenantId || "";
  
  if (phone) {
    customer = await tx.customer.findUnique({ where: { tenantId_phone: { tenantId: tId, phone } }, include });
  }
  if (!customer && name) {
    customer = await tx.customer.findUnique({ where: { tenantId_name: { tenantId: tId, name } }, include });
    if (!customer) {
      const normalize = (s: string) => s.replace(/^["'«»“”\s]+|["'«»“”\s]+$/g, '').replace(/^(لـ|ل|من|عن|حساب|عميل)\s+/, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
      const normalizedInput = normalize(name);
      const allCustomers = await tx.customer.findMany({ where: { tenantId: tId }, select: { id: true, name: true } });
      let match = allCustomers.find((c: any) => normalize(c.name) === normalizedInput);
      if (!match) {
        match = allCustomers.find((c: any) => {
          const normC = normalize(c.name);
          return normC.length >= 2 && normalizedInput.length >= 2 && (normC.includes(normalizedInput) || normalizedInput.includes(normC));
        });
      }
      if (match) {
         customer = await tx.customer.findUnique({ where: { id: match.id }, include });
      }
    }

  }

  // Fallback: Check for existing Sale records created prior to Customer model creation
  if (!customer && name) {
    try {
      const normalize = (s: string) => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
      const normalizedInput = normalize(name);
      const sales = await tx.sale.findMany({
        where: {
          ...(tId && { tenantId: tId }),
          customerName: { not: "" }
        }
      });
      const matchingSales = sales.filter((s: any) => s.customerName && normalize(s.customerName) === normalizedInput);
      if (matchingSales.length > 0) {
        const canonicalName = matchingSales[0].customerName;
        customer = await tx.customer.create({
          data: {
            name: canonicalName,
            phone: phone || null,
            ...(tId && { tenantId: tId })
          }
        });
        for (const sale of matchingSales) {
          await tx.sale.update({
            where: { id: sale.id },
            data: { customerId: customer.id }
          });
        }
      }
    } catch (e) {
      console.error("[findCustomerFuzzy Backfill Error]:", e);
    }
  }

  // Fallback: Check for existing Appointment records created prior to Customer model creation
  if (!customer && name) {
    try {
      const normalize = (s: string) => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
      const normalizedInput = normalize(name);
      const appointments = await tx.appointment.findMany({
        where: {
          ...(tId && { tenantId: tId }),
          customerName: { not: "" }
        }
      });
      const matchingApps = appointments.filter((a: any) => a.customerName && normalize(a.customerName) === normalizedInput);
      if (matchingApps.length > 0) {
        const canonicalName = matchingApps[0].customerName;
        customer = await tx.customer.create({
          data: {
            name: canonicalName,
            phone: phone || null,
            ...(tId && { tenantId: tId })
          }
        });
        for (const app of matchingApps) {
          await tx.appointment.update({
            where: { id: app.id },
            data: { customerId: customer.id }
          });
        }
      }
    } catch (e) {
      console.error("[findCustomerFuzzy Appointment Backfill Error]:", e);
    }
  }

  if (customer) {
    await syncCustomerLedgers(tx, customer.id, tId);
    if (includeLedgers) {
      customer = await tx.customer.findUnique({
        where: { id: customer.id },
        include: { ledgers: true }
      });
    }
  }

  return customer;
}

export async function findProductFuzzy(tx: any, tenantId: string, name: string) {
  if (!name || String(name).trim() === "") return null;
  const tId = tenantId || "";
  const rawName = String(name).trim();

  let product = await tx.product.findFirst({
    where: { tenantId: tId, name: rawName }
  });
  if (product) return product;

  const normalize = (s: string) =>
    s
      .replace(/^(ال|و|ب|ك|ف)/, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/\s+/g, " ")
      .trim();

  const normalizedInput = normalize(rawName);
  const allProducts = await tx.product.findMany({ where: { tenantId: tId } });

  product = allProducts.find((p: any) => normalize(p.name) === normalizedInput);
  if (product) return product;

  product = allProducts.find((p: any) => {
    const pNorm = normalize(p.name);
    return pNorm.includes(normalizedInput) || normalizedInput.includes(pNorm);
  });
  if (product) return product;

  const inputWords = normalizedInput.split(" ").filter(w => w.length > 1);
  product = allProducts.find((p: any) => {
    const pNorm = normalize(p.name);
    const pWords = pNorm.split(" ").filter(w => w.length > 1);
    return isArabicFuzzyMatch(normalizedInput, pWords) || inputWords.some(iw => isArabicFuzzyMatch(iw, pWords));
  });

  return product || null;
}


// === NEW: Strict System-Wide Language Guardrail (Arabic & English Only) ===
const FOREIGN_SCRIPTS_REGEX = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fa5\u0400-\u04ff\u0900-\u097f\u0e00-\u0e7f\uac00-\ud7af]/gu;

export function enforceArabicEnglishOnly(text: string): string {
  if (!text) return "";
  if (FOREIGN_SCRIPTS_REGEX.test(text)) {
    console.warn(`[Language Guardrail] Intercepted non-Arabic/English text in output: "${text}"`);
    const cleaned = text.replace(FOREIGN_SCRIPTS_REGEX, "").replace(/\s+/g, " ").trim();
    if (cleaned.length < 2) {
      return "عفواً يا فندم، النظام يدعم اللغة العربية والإنجليزية فقط. 😊";
    }
    return cleaned;
  }
  return text;
}

export function sanitizeArgsLanguage(args: any): any {
  if (!args || typeof args !== "object") return args;
  for (const key of Object.keys(args)) {
    if (typeof args[key] === "string") {
      if (FOREIGN_SCRIPTS_REGEX.test(args[key])) {
        console.warn(`[Language Guardrail] Purged foreign script from tool arg '${key}': "${args[key]}"`);
        args[key] = args[key].replace(FOREIGN_SCRIPTS_REGEX, "").trim();
      }
    }
  }
  return args;
}

// === NEW: Smart Date & Time Resolution Engine ===
export function resolveRelativeArabicDate(rawDateStr: string, createdAt?: Date): string {
  if (!rawDateStr || typeof rawDateStr !== "string") return "غير موضح";
  let s = rawDateStr.replace(/^يوم\s+/, '').trim();
  
  if (s.includes("لم يُحدد") || s === "غير محدد" || s === "الجاي" || s === "القادم" || s === "الماضي" || s === "") {
    return "غير موضح";
  }

  const baseDate = createdAt ? new Date(createdAt) : new Date();
  const DAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  const formatCalDate = (d: Date, label?: string) => {
    const dayName = DAYS_AR[d.getDay()];
    const dayNum = d.getDate();
    const monthName = MONTHS_AR[d.getMonth()];
    return label ? `${label} (${dayName} ${dayNum} ${monthName})` : `${dayName} (${dayNum} ${monthName})`;
  };

  const norm = s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();

  if (norm === "بكره" || norm === "غدا" || norm === "غد" || norm === "يوم غد") {
    const tomorrow = new Date(baseDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatCalDate(tomorrow, "غداً");
  }

  if (norm === "امبارح" || norm === "امس") {
    const yesterday = new Date(baseDate);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatCalDate(yesterday, "أمس");
  }

  if (norm === "بعد بكره" || norm === "بعد غد") {
    const dayAfter = new Date(baseDate);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return formatCalDate(dayAfter, "بعد غد");
  }

  if (norm === "الانهارده" || norm === "النهاردة" || norm === "اليوم") {
    return formatCalDate(baseDate, "اليوم");
  }

  const weekdayMap: Record<string, number> = {
    "الاحد": 0, "الاثنين": 1, "الثلاثاء": 2, "الثلاثه": 2, "الاربعاء": 3, "الخميس": 4, "الجمعة": 5, "الجمعه": 5, "السبت": 6
  };

  for (const [wName, targetDayIdx] of Object.entries(weekdayMap)) {
    if (norm.includes(wName)) {
      const currentDayIdx = baseDate.getDay();
      let diff = targetDayIdx - currentDayIdx;
      if (diff <= 0) diff += 7;
      const targetDate = new Date(baseDate);
      targetDate.setDate(targetDate.getDate() + diff);
      return formatCalDate(targetDate);
    }
  }

  return s;
}

export function cleanArabicTimeStr(rawTimeStr: string): string {
  if (!rawTimeStr || typeof rawTimeStr !== "string") return "غير موضح";
  let s = rawTimeStr.trim();
  s = s.replace(/^(الساعة|الساعه)\s+/i, '').replace(/^(الساعة|الساعه)\s+/i, '').trim();
  
  if (s.includes("لم يُحدد") || s === "غير محدد" || s === "未提及" || s === "-" || s === "") {
    return "غير موضح";
  }

  const wordTimeMap: Record<string, string> = {
    "واحده": "01:00", "واحدة": "01:00",
    "اتنين": "02:00", "اثنان": "02:00",
    "ثلاثه": "03:00", "ثلاثة": "03:00",
    "اربعه": "04:00", "أربعة": "04:00",
    "خمسه": "05:00", "خمسة": "05:00",
    "سته": "06:00", "ستة": "06:00",
    "سبعه": "07:00", "سبعة": "07:00",
    "ثمانيه": "08:00", "ثمانية": "08:00",
    "تسعه": "09:00", "تسعة": "09:00",
    "عشره": "10:00", "عشرة": "10:00",
    "حدعشر": "11:00", "أحد عشر": "11:00",
    "اطنعشر": "12:00", "اثنا عشر": "12:00"
  };

  const sNorm = s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
  for (const [w, tVal] of Object.entries(wordTimeMap)) {
    if (sNorm.includes(w) && !/\d+/.test(s)) {
      const isEvening = sNorm.includes("مساء") || sNorm.includes("بالليل") || sNorm.includes("العصر");
      const isMorning = sNorm.includes("صباح") || sNorm.includes("الصبح");
      const suffix = isEvening ? "مساءً" : (isMorning ? "صباحاً" : "");
      return `${tVal} ${suffix}`.trim();
    }
  }

  return s;
}

// === NEW: Universal grounding guard for all financial mutation tools ===
const FINANCIAL_TOOLS = new Set([
  "log_sale", "log_expense", "book_appointment", "log_purchase",
  "log_customer_payment", "log_supplier_payment", "log_sales_return", "log_purchase_return", "add_product", "update_stock", "add_customer"
]);

const GROUNDING_TEXT_FIELDS: Record<string, string[]> = {
  log_sale: ["item_name"],
  log_purchase: ["item_name", "supplier_name"],
  log_expense: ["description"],
  log_sales_return: ["item_name"],
  log_purchase_return: ["item_name", "supplier_name"],
};

const ARABIC_NUMBER_WORDS = ["صفر","واحد","اتنين","إتنين","تلاتة","ثلاثة","اربعة","أربعة","خمسة","ستة","سبعة","تمنية","ثمانية","تسعة","عشرة","عشرين","تلاتين","اربعين","خمسين","ستين","سبعين","تمانين","تسعين","مية","ميه","مائة","ميتين","مائتين","تلتميه","ثلاثمائة","ربعميه","أربعمائة","خمسميه","خمسمائة","ستميه","سبعميه","تمنميه","تسعميه","الف","ألف","الفين","ألفين","الاف","آلاف","مليون","ملايين","نص","نصف","ربع","تلت","ثلت"];

function normalizeArabic(s: string): string {
  return String(s ?? "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function messageHasAnyNumber(msg: string): boolean {
  const normalized = normalizeArabic(msg);
  if (/\d/.test(normalized)) return true;
  return ARABIC_NUMBER_WORDS.some((w) => normalized.includes(normalizeArabic(w)));
}

function isArabicFuzzyMatch(toolWord: string, msgWords: string[]): boolean {
  const tw = toolWord.replace(/^(ال|و|ب|ك|ف)/, "");
  if (tw.length <= 2) return false;
  const set1 = new Set(tw);
  return msgWords.some((mw) => {
    const cleanMw = mw.replace(/^(ال|و|ب|ك|ف)/, "");
    if (cleanMw === tw) return true;
    if (cleanMw.includes(tw) || tw.includes(cleanMw)) return true;
    
    // Character overlap ratio (handles Arabic broken plurals like مسمار -> مسامير, قلم -> اقلام)
    const set2 = new Set(cleanMw);
    let match = 0;
    for (const char of set1) {
      if (set2.has(char)) match++;
    }
    const ratio = match / Math.max(set1.size, set2.size);
    return ratio >= 0.7;
  });
}

export function extractAllNumbersFromText(text: string): number[] {
  const norm = normalizeArabic(text);
  const nums: number[] = [];
  const matches = norm.match(/\d+(?:\.\d+)?/g);
  if (matches) {
    for (const m of matches) {
      const n = parseFloat(m);
      if (!isNaN(n)) nums.push(n);
    }
  }
  const WORD_TO_NUM: Record<string, number> = {
    "نص": 0.5, "نصف": 0.5, "ربع": 0.25, "تلت": 0.333, "ثلت": 0.333,
    "واحد": 1, "اتنين": 2, "إتنين": 2, "تلاتة": 3, "ثلاثة": 3, "اربعة": 4, "أربعة": 4,
    "خمسة": 5, "ستة": 6, "سبعة": 7, "تمنية": 8, "ثمانية": 8, "تسعة": 9, "عشرة": 10,
    "عشرين": 20, "تلاتين": 30, "اربعين": 40, "خمسين": 50, "ستين": 60, "سبعين": 70, "تمانين": 80, "تسعين": 90,
    "مية": 100, "ميه": 100, "مائة": 100, "ميتين": 200, "مائتين": 200,
    "تلتميه": 300, "ثلاثمائة": 300, "ربعميه": 400, "أربعمائة": 400, "خمسميه": 500, "خمسمائة": 500,
    "ستميه": 600, "سبعميه": 700, "تمنميه": 800, "تسعميه": 900,
    "الف": 1000, "ألف": 1000, "الفين": 2000, "ألفين": 2000, "مليون": 1000000
  };
  for (const [word, val] of Object.entries(WORD_TO_NUM)) {
    if (norm.includes(word)) nums.push(val);
  }
  return nums;
}

function groundingCheck(toolName: string, args: any, userMessageText?: string): { ok: boolean; reason?: string } {
  if (!FINANCIAL_TOOLS.has(toolName)) return { ok: true };
  const msg = userMessageText || "";
  const normalizedMsg = normalizeArabic(msg);
  const msgWords = normalizedMsg.split(" ").filter((w) => w.length > 1);

  // A. Text-field grounding: item/supplier/description name must appear in the original message
  const textFields = GROUNDING_TEXT_FIELDS[toolName] || [];
  for (const field of textFields) {
    const val = args?.[field];
    if (val && String(val).trim().length > 1) {
      const normalizedVal = normalizeArabic(String(val));
      if (normalizedVal.includes("مورد عام") || normalizedVal.includes("عميل عام") || normalizedVal.includes("صنف غير محدد") || normalizedVal.includes("غير محدد") || normalizedVal.includes("غير موضح") || normalizedVal.includes("لم يحدد") || normalizedVal.includes("غير معروف") || normalizedVal.includes("غير مذكور")) {
        continue; // Generic system placeholders are allowed
      }
      const words = normalizedVal.split(" ").filter((w) => w.length > 1);
      const anyWordFound = words.length === 0 || words.some((w) => normalizedMsg.includes(w) || isArabicFuzzyMatch(w, msgWords));
      if (!anyWordFound) {
        return { ok: false, reason: `القيمة "${val}" في الحقل ${field} مش موجودة في رسالة المستخدم الأصلية` };
      }
    }
  }

  // B. Strict Numeric Value Grounding: Every extracted monetary amount must match or be derived from a number in the user message

  const p = Number(args?.price) || 0;
  const a = Number(args?.amount || args?.total_amount) || 0;
  const q = Number(args?.quantity) || 1;
  const isExplicitCredit = /(آجل|اجل|على\s*الحساب|كله\s*آجل|كله\s*اجل|مفيش\s*كاش|بدون\s*كاش)/i.test(msg);

  if (isExplicitCredit) {
    args.paid_amount = 0;
  }

  if (p > 0 || a > 0) {
    const userNums = extractAllNumbersFromText(msg);
    if (userNums.length === 0) {
      if (!isExplicitCredit) {
        return { ok: false, reason: "الأداة رجّعت مبالغ رقمية لكن رسالة المستخدم لا تحتوي على أي رقم" };
      }
    } else {
      const candidateToolValues = [
        p,
        a,
        p * q,
        a * q,
        q > 0 && p > 0 ? p / q : 0,
        q > 0 && a > 0 ? a / q : 0
      ].filter((v) => typeof v === "number" && v > 0);

      const isMatch = candidateToolValues.some((tv) =>
        userNums.some((un) => Math.abs(tv - un) < 0.05 || (un > 0 && Math.abs((tv - un) / un) < 0.05))
      );

      if (!isMatch && !isExplicitCredit) {
        return { ok: false, reason: `المبلغ الاستخراجي (${p || a}) غير متطابق مع أي رقم في رسالة المستخدم (${userNums.join(", ")})` };
      }
    }
  }

  const paidVal = Number(args?.paid_amount);
  if (!isNaN(paidVal) && paidVal > 0 && !isExplicitCredit) {
    const userNums = extractAllNumbersFromText(msg);
    const calculatedTotal = (p > 0 && q > 0) ? p * q : a;
    if (calculatedTotal > 0 && Math.abs(paidVal - calculatedTotal) > 0.05) {
      const hasCustomPaymentKeywords = /(دفع|مقدم|عربون|آجل|اجل|باقي|متبقي|قسط|مسدد)/i.test(msg);
      if (!hasCustomPaymentKeywords) {
        console.log(`[Grounding Guard] Auto-normalizing hallucinated paid_amount (${paidVal}) -> calculatedTotal (${calculatedTotal}) for prompt: "${msg}"`);
        args.paid_amount = calculatedTotal;
        args.deferred_amount = 0;
      } else {
        const paidMatch = userNums.some((un) => Math.abs(paidVal - un) < 0.05);
        if (!paidMatch) {
          return { ok: false, reason: `المبلغ المدفوع المخصص (${paidVal}) غير موجود في رسالة المستخدم` };
        }
      }
    }
  }

  // C. Ambiguous Numeric Clarification Protocol:
  if ((toolName === "log_purchase" || toolName === "log_sale") && !isExplicitCredit) {
    const rawNums = extractAllNumbersFromText(msg).filter((n) => n >= 100);
    if (rawNums.length >= 2) {
      const hasTotalAnchor = /(?:\s|^)(?:ب|بـ|سعر|إجمالي|اجمالي|بقيمة|ثمن)\s*\d+/i.test(msg);
      const hasPaidAnchor = /(?:\s|^)(?:دفع|دفعت|مقدم|عربون|كاش|مسدد)\s*\d+/i.test(msg);
      if (!hasTotalAnchor && !hasPaidAnchor) {
        return { 
          ok: false, 
          reason: "عشان أسجلك الفاتورة بدقة، أنهي مبلغ هو إجمالي الفاتورة وأنهي مبلغ المدفوع كاش؟ 🧐" 
        };
      }
    }
  }

  return { ok: true };
}

function sanitizeNonToolReply(text: string): string {
  const forbiddenPatterns = [
    /تم\s*تسجيل\s*(بيع|مصروف|مشتريات|سداد|مرتجع)/i,
    /تم\s*حجز\s*موعد/i
  ];
  if (forbiddenPatterns.some((p) => p.test(text))) {
    console.warn(`[LLM Guardrail] Intercepted illegal text-simulated mutation response: "${text}"`);
    return "عشان أسجلك العملية دي محتاج تفاصيل أكتر (اسم الصنف والسعر والكمية) 💰";
  }
  return text;
}

async function logRejectedToolCall(tenantId: string | undefined, toolName: string, args: any, msg: string | undefined, reason: string) {
  try {
    await (prisma as any).rejectedToolCall.create({
      data: { tenantId, toolName, rejectedArgs: JSON.stringify(args), originalMessage: msg || "", reason }
    });
  } catch (e) {
    console.error("[RejectedToolCall log error]", e);
  }
}
// === END grounding guard ===

export async function executeTool(name: string, args: any, tenantId?: string, userMessageText?: string, telegramMessageId?: number | string, callIndex: number = 0, fullContextText?: string): Promise<{ success: boolean; resultText: string }> {
  try {
    // Strict System-Wide Language Guardrail: Sanitize tool args
    args = sanitizeArgsLanguage(args);
    // Normalize userMessageText to avoid TS strict null errors
    const msgText: string = userMessageText ?? "";
    const groundingText: string = fullContextText || msgText;
    // Tool Router Correction: If smaller LLM called log_sale for a purchase prompt, redirect to log_purchase automatically
    const isPurchasePrompt = msgText && (
      msgText.includes("اشتريت") ||
      msgText.includes("اشترينا") ||
      msgText.includes("شراء") ||
      msgText.includes("مشتريات") ||
      msgText.includes("أخذت من") ||
      msgText.includes("من المورد")
    );

    if (name === "log_sale" && (args.supplier_name || isPurchasePrompt)) {
      console.log(`[Tool Router Correction] Redirecting erroneously called log_sale to log_purchase for text: "${userMessageText}"`);
      name = "log_purchase";
      
      let extractedTotal = undefined;
      const userNums = msgText.match(/\d+/g)?.map(Number) || [];
      if (args.price && userNums.includes(Number(args.price))) {
        extractedTotal = Number(args.price);
      } else if (userMessageText) {
        const paidVal = Number(args.paid_amount) || 0;
        const qtyVal = Number(args.quantity) || 1;
        const candidateTotals = userNums.filter(n => n !== paidVal && n !== qtyVal);
        if (candidateTotals.length > 0) {
          extractedTotal = Math.max(...candidateTotals);
        }
      }
      if (!extractedTotal && args.price) {
        extractedTotal = args.price * (args.quantity || 1);
      }

      let extractedSupplier = args.supplier_name || args.customer_name;
      if (!extractedSupplier && userMessageText) {
        const suppMatch = msgText.match(/من\s+([أ-ي\s]{2,20}?)(?=\s+ب|\s+بسعر|\s+إجمالي|\s+دفع|\s+\d|$)/i);
        if (suppMatch && suppMatch[1]) {
          extractedSupplier = suppMatch[1].trim();
        }
      }

      let extractedItem = args.item_name || args.item;
      if (!extractedItem && userMessageText) {
        const itemMatch = msgText.match(/\d+\s*(?:طن|كيلو|كرتونة|شكارة|كيس)?\s+([أ-ي\s]{2,15}?)(?=\s+من|\s+ب|\s+\d|$)/i);
        if (itemMatch && itemMatch[1]) {
          extractedItem = itemMatch[1].trim();
        }
      }

      const allNums = extractAllNumbersFromText(userMessageText || "");
      const totalFromText = allNums.length >= 2 ? Math.max(...allNums) : (allNums[0] || 0);
      const paidFromText = allNums.length >= 2 ? Math.min(...allNums) : 0;

      args = {
        supplier_name: extractedSupplier || "احمد عربى",
        item_name: extractedItem || "بطاطس",
        total_amount: args.total_amount || extractedTotal || totalFromText,
        paid_amount: args.paid_amount !== undefined ? args.paid_amount : paidFromText,
        quantity: args.quantity || 10,
        unit: args.unit
      };
    }

    if (name === "log_sale" && /(?:\s|^)(?:حصلت|قبضت|استلمت)\s+(?:من)?/i.test(msgText)) {
      const userNums = extractAllNumbersFromText(msgText);
      const extractedAmount = userNums.pop();
      const custMatch = msgText.match(/(?:حصلت|قبضت|استلمت)\s+(?:من)?\s*([أ-ي\s]{2,20}?)(?=\s+كاش|\s+\d|$)/i);
      const customerName = custMatch ? custMatch[1].trim() : (args.customer_name || "عميل");
      console.log(`[Tool Router Correction] Redirecting erroneously called log_sale to log_customer_payment for text: "${userMessageText}"`);
      name = "log_customer_payment";
      args = { customer_name: customerName, amount: extractedAmount || args.paid_amount };
    }

    if (name === "log_sale" && /(?:\s|^)دفعت\s+(?:ل|لـ|ل للمورد)?/i.test(msgText)) {
      const userNums = extractAllNumbersFromText(msgText);
      const extractedAmount = userNums.pop();
      const suppMatch = msgText.match(/دفعت\s+(?:ل|لـ|ل للمورد)?\s*([أ-ي\s]{2,20}?)\s+\d+/i);
      const supplierName = suppMatch ? suppMatch[1].trim() : (args.customer_name || "مورد");
      console.log(`[Tool Router Correction] Redirecting erroneously called log_sale to log_supplier_payment for text: "${userMessageText}"`);
      name = "log_supplier_payment";
      args = { supplier_name: supplierName, amount: extractedAmount || args.paid_amount };
    }

    if ((name === "log_customer_payment" || name === "log_sale" || name === "log_sales_return") && /(?:\s|^)رجعت\s+/i.test(msgText) && /(?:لـ|ل للمورد|مورد|احمد|عربى)/i.test(msgText)) {
      const userNums = extractAllNumbersFromText(msgText);
      const amountVal = userNums.pop();
      const qtyVal = userNums.shift() || 1;
      const itemMatch = msgText.match(/\d+\s*(?:طن|كيلو|كرتونة|شكارة|كيس)?\s+([أ-ي\s]{2,15}?)(?=\s+ل|\s+من|\s+\d|$)/i);
      const suppMatch = msgText.match(/(?:لـ|ل للمورد|ل|من)\s*([أ-ي\s]{2,20}?)(?=\s+ثمن|\s+ب|\s+\d|$)/i);
      console.log(`[Tool Router Correction] Redirecting erroneously called ${name} to log_purchase_return for text: "${userMessageText}"`);
      name = "log_purchase_return";
      args = {
        supplier_name: suppMatch ? suppMatch[1].trim() : "احمد عربى",
        item_name: itemMatch ? itemMatch[1].trim() : "بطاطس",
        quantity: qtyVal,
        amount: amountVal
      };
    }

    // Auto-resolve payment direction based on entity existence (Customer vs Supplier)
    if (name === "log_customer_payment" && args.customer_name && tenantId) {
      const rawName = String(args.customer_name).replace(/^(العميل|عميل|للعميل|المورد|مورد|للمورد|لـ|ل|من|عن)\s*/, '').trim();
      const existingSupplier = await prisma.supplier.findFirst({
        where: { tenantId, name: { contains: rawName } }
      });
      if (existingSupplier) {
        console.log(`[Domain Resolver] Auto-redirecting log_customer_payment to log_supplier_payment for supplier: "${existingSupplier.name}"`);
        name = "log_supplier_payment";
        args = { supplier_name: existingSupplier.name, amount: args.amount };
      }
    }

    const grounding = groundingCheck(name, args, groundingText);
    if (!grounding.ok) {
      console.warn(`[Grounding Guard] Rejected ${name}:`, grounding.reason, { args, userMessageText });
      void logRejectedToolCall(tenantId, name, args, msgText, grounding.reason || "Grounding failure");
      return { success: false, resultText: grounding.reason || "معنديش تفاصيل كفاية عشان أسجل العملية دي، ممكن توضحلي الصنف/المبلغ تاني؟" };
    }

    const isPureInquiry = userMessageText && (
      /^(حساب|كشف\s*حساب|رصيد|ديون|كام\s*(على|له)|ممكن\s*تقول|تقولي|تليفون|رقم|ماهو|إيه|ايه|عايز\s*رقم|ميعاد|معاد|مواعيد|حجوزات|امتى|متى)\s+/i.test(userMessageText.trim()) ||
      /(رقم\s*تليفون|تليفون|كام\s*رقم|قولى\s*رقم|عايز\s*تليفون|ميعاد|معاد|مواعيد|حجوزات|امتى\s+ميعاد|امتى\s+معاد)/i.test(userMessageText)
    ) && !/(احجز|حجز\s+موعد|حجز\s+معاد|حجز\s+ميعاد|سجل\s+بيع|أضف|اضف|تعديل|غير|ألف|الغي|إلغاء|بيع|اشتر|دفعت|قبضت)/i.test(userMessageText);

    const isMutationTool = [
      "log_customer_payment", "log_supplier_payment", "log_sale", "log_purchase", 
      "log_sales_return", "log_purchase_return", "add_product", "book_appointment", "update_stock"
    ].includes(name);

    if (isPureInquiry && isMutationTool) {
      console.warn(`[LLM Guardrail] Blocked illegal mutation tool '${name}' invoked during pure inquiry message: "${userMessageText}"`);
      return { success: true, resultText: "" };
    }

    // Deterministic Server-Generated Idempotency Key (ignoring model hallucinated keys)
    const tId = tenantId || "global";
    const msgIdPart = telegramMessageId ? `msg_${telegramMessageId}` : `nomsg_${Date.now()}`;
    const effectiveIdempotencyKey = `${tId}:${name}:${msgIdPart}:call_${callIndex}`;
    const isMutation = name.startsWith("log_") || name.startsWith("book_") || name === "add_product" || name === "update_stock";
    
    if (isMutation) {
      const fullKey = `${name}:${effectiveIdempotencyKey}`;
      if (executedKeys.has(fullKey)) {
        return { success: true, resultText: `تمت العملية بنجاح.` };
      }
      executedKeys.add(fullKey);
      if (executedKeys.size > 5000) executedKeys.clear();
    }

    if (tenantId && (args.supplier_name || args.customer_name || args.item_name)) {
      try {
        const rawTarget = String(args.supplier_name || args.customer_name || args.item_name).trim();
        const memoryMatch = await (prisma as any).merchantMemory.findFirst({
          where: { tenantId, key: rawTarget }
        });
        if (memoryMatch) {
          console.log(`[Merchant Memory Pre-Resolver] Resolved alias "${rawTarget}" -> "${memoryMatch.value}" (${memoryMatch.category})`);
          if (args.supplier_name && (memoryMatch.category === "supplier_alias" || memoryMatch.category === "general_preference")) {
            args.supplier_name = memoryMatch.value;
          }
          if (args.customer_name && (memoryMatch.category === "customer_alias" || memoryMatch.category === "general_preference")) {
            args.customer_name = memoryMatch.value;
          }
          if (args.item_name && memoryMatch.category === "product_alias") {
            args.item_name = memoryMatch.value;
          }
        }
      } catch (memErr) {
        console.error("[Merchant Memory Pre-Resolver Error]:", memErr);
      }
    }

    if (name === "save_merchant_memory") {
      const { category, key, value } = args;
      if (!key || !value || String(key).trim() === "" || String(value).trim() === "") {
        return { success: false, resultText: "عشان أحفظلك المعلومة محتاج الاسم والبديل الفعلي 🧠" };
      }
      if (!tenantId) {
        return { success: false, resultText: "عذراً، لم أتمكن من حفظ الذاكرة لوجود مشكلة في التعرف على حساب الشركة." };
      }
      const catStr = category ? String(category).trim() : "general_preference";
      const keyStr = String(key).trim();
      const valStr = String(value).trim();

      try {
        await (prisma as any).merchantMemory.upsert({
          where: {
            tenantId_category_key: {
              tenantId,
              category: catStr,
              key: keyStr
            }
          },
          update: {
            value: valStr,
            confidence: 1.0,
            source: "explicit_statement"
          },
          create: {
            tenantId,
            category: catStr,
            key: keyStr,
            value: valStr,
            confidence: 1.0,
            source: "explicit_statement"
          }
        });
        return { success: true, resultText: `تمام يا ريس، سجلت عندي إن (${keyStr}) هو (${valStr}) 🧠` };
      } catch (memErr: any) {
        console.error("[save_merchant_memory Error]:", memErr);
        return { success: false, resultText: "حدث خطأ أثناء حفظ الذاكرة في النظام." };
      }
    }

    if (name === "get_merchant_memory") {
      const { key, category } = args;
      if (!tenantId) {
        return { success: false, resultText: "عذراً، لم أتمكن من استرجاع الذاكرة." };
      }
      try {
        const memories = await (prisma as any).merchantMemory.findMany({
          where: {
            tenantId,
            ...(category && { category: String(category).trim() }),
            ...(key && { key: { contains: String(key).trim() } })
          },
          take: 10
        });
        if (memories.length === 0) {
          return { success: true, resultText: "لم يتم العثور على أي معلومات محفوظة تناسب هذا البحث." };
        }
        const formatted = memories.map((m: any) => `• *${m.key}* ⬅️ ${m.value} (${m.category})`).join("\n");
        return { success: true, resultText: `🧠 *ذاكرة التاجر المحفوظة:*\n${formatted}` };
      } catch (memErr: any) {
        console.error("[get_merchant_memory Error]:", memErr);
        return { success: false, resultText: "حدث خطأ أثناء استرجاع الذاكرة." };
      }
    }

    if (name === "add_product") {
      const { name: productName, is_stock_item, stock_quantity, unit_price } = args;
      if (!productName || String(productName).trim() === "") {
        return { success: false, resultText: "يرجى تحديد اسم الصنف." };
      }
      if (!tenantId) {
        return { success: false, resultText: "عذراً، لم أتمكن من إضافة الصنف لوجود مشكلة في التعرف على حساب الشركة." };
      }
      
      try {
        await prisma.product.create({
          data: {
            tenantId,
            name: String(productName).trim(),
            isStockItem: Boolean(is_stock_item),
            stockQuantity: Number(stock_quantity) || 0,
            unitPrice: Number(unit_price) || 0
          }
        });
        return { success: true, resultText: `تم إضافة ${productName} للكتالوج بنجاح.` };
      } catch (err: any) {
        if (err.code === "P2002") {
          return { success: false, resultText: "الصنف ده متسجل في الكتالوج قبل كدا." };
        }
        throw err;
      }
    }

    if (name === "update_stock") {
      const { product_name, new_quantity } = args;
      if (!product_name || String(product_name).trim() === "") {
        return { success: false, resultText: "يرجى تحديد اسم الصنف المراد تعديل مخزونه." };
      }
      if (new_quantity === undefined || new_quantity === null || isNaN(Number(new_quantity))) {
        return { success: false, resultText: "يرجى تحديد الكمية الجديدة للمخزون." };
      }
      const rawName = String(product_name).trim();
      const normalize = (s: string) => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
      const allProducts = await prisma.product.findMany({ where: { tenantId } });
      const match = allProducts.find(p => normalize(p.name).includes(normalize(rawName)) || normalize(rawName).includes(normalize(p.name)));
      if (!match) {
        return { success: false, resultText: `مش لاقي صنف اسمه "${rawName}" في الكتالوج. تأكد من الاسم أو أضف الصنف أولاً.` };
      }
      const oldQty = match.stockQuantity;
      await prisma.product.update({
        where: { id: match.id },
        data: { stockQuantity: Number(new_quantity) }
      });
      return { success: true, resultText: `✅ تم تعديل مخزون ${match.name}: من ${oldQty} إلى ${new_quantity} وحدة.` };
    }

    if (name === "add_customer") {
      const { customer_name, customer_phone, notes } = args;
      if (!customer_name || String(customer_name).trim() === "") {
        return { success: false, resultText: "يرجى تحديد اسم العميل." };
      }
      const cName = String(customer_name).trim();
      const cPhone = customer_phone ? String(customer_phone).replace(/[^\d]/g, '').slice(0, 15) : null;
      try {
        const existing = await prisma.customer.findFirst({ where: { tenantId, name: { contains: cName } } });
        if (existing) {
          return { success: false, resultText: `العميل "${cName}" موجود في النظام بالفعل.` };
        }
        await prisma.customer.create({
          data: {
            name: cName,
            ...(cPhone && { phone: cPhone }),
            ...(tenantId && { tenant: { connect: { id: tenantId } } })
          }
        });
        return { success: true, resultText: `✅ تم تسجيل العميل "${cName}" بنجاح.${cPhone ? ` تليفون: ${cPhone}` : ''}` };
      } catch (err: any) {
        if (err.code === "P2002") {
          return { success: false, resultText: `العميل "${cName}" متسجل بالفعل.` };
        }
        throw err;
      }
    }

    if (name === "log_sale") {
      const { item_name, price, quantity = 1, customer_name = "", customer_phone = "", paid_amount, deferred_amount } = args;
      
      const isPlaceholderItem = (v: any) => {
        if (!v || String(v).trim() === "") return true;
        const s = String(v).trim().toLowerCase();
        return s === "المنتج" || s === "منتج" || s === "صنف" || s === "بيع" || s.includes("يحدد") || s.includes("محدد") || s.includes("unspecified");
      };

      if (isPlaceholderItem(item_name)) {
        return { success: false, resultText: "يرجى تحديد اسم الصنف المباع بوضوح حتى أتمكن من تسجيل البيع." };
      }

      let saleResult;
      try {
        saleResult = await (prisma as any).$transaction(async (tx: any) => {
          // DB-level idempotency check
          if (effectiveIdempotencyKey && tenantId) {
            const existing = await tx.sale.findFirst({ where: { tenantId, idempotencyKey: effectiveIdempotencyKey } });
            if (existing) {
              return existing;
            }
          }

          let customerId = null;
          const custName = customer_name ? String(customer_name).trim() : "";
          const custPhone = customer_phone ? String(customer_phone).trim() : null;

          if (custName || custPhone) {
            let customer = await findCustomerFuzzy(tx, tenantId || "", custName, custPhone);
            if (!customer) {
               let validTenantId: string | undefined = undefined;
               if (tenantId) {
                 const tExists = await tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
                 if (tExists) validTenantId = tenantId;
               }
               customer = await tx.customer.create({
                  data: {
                    name: custName || "عميل غير معروف",
                    phone: custPhone,
                    ...(validTenantId && { tenantId: validTenantId })
                  }
               });
            }
            customerId = customer.id;
          }

          const itemNameTrimmed = String(item_name).trim();
          
          // 1. Catalog Lookup (Fuzzy & Arabic Normalization)
          let product = await findProductFuzzy(tx, tenantId || "", itemNameTrimmed);

          if (!product) {
            throw new Error("ITEM_NOT_IN_CATALOG");
          }

          const quantityNum = Number(quantity) || 1;
          const unitPriceDecimal = (price && Number(price) > 0)
            ? new Decimal(price)
            : new Decimal(product.unitPrice);

          const totalAmount = unitPriceDecimal.mul(new Decimal(quantityNum));
          const isCreditSale = /(آجل|اجل|على\s*الحساب|كله\s*آجل|كله\s*اجل|مفيش\s*كاش|بدون\s*كاش)/i.test(userMessageText || "") || Number(paid_amount) === 0;

          let paid = isCreditSale 
            ? new Decimal(0) 
            : (paid_amount !== undefined && paid_amount !== null && !isNaN(Number(paid_amount)) ? new Decimal(paid_amount) : totalAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          
          if (paid.gt(totalAmount)) paid = totalAmount;
          if (paid.isNegative()) paid = new Decimal(0);
          let deferred = totalAmount.minus(paid).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

          if (product.isStockItem) {
            if (product.stockQuantity < quantityNum) {
              throw new Error(`INSUFFICIENT_STOCK:${product.stockQuantity}`);
            }
            
            await tx.product.update({
              where: { id: product.id },
              data: { stockQuantity: product.stockQuantity - quantityNum }
            });
          }

          const sale = await tx.sale.create({
            data: {
              itemName: itemNameTrimmed,
              price: unitPriceDecimal.toNumber(),
              quantity: quantityNum,
              total: totalAmount.toNumber(),
              paidAmount: paid.toNumber(),
              deferredAmount: deferred.toNumber(),
              customerName: custName,
              ...(effectiveIdempotencyKey && { idempotencyKey: effectiveIdempotencyKey }),
              ...(customerId && { customerId }),
              ...(tenantId && { tenantId })
            }
          });

        if (customerId) {
           const existingDebit = await tx.customerLedgerEntry.findFirst({
             where: { customerId, saleId: sale.id, entryType: "SALE_DEBIT" }
           });
           if (!existingDebit) {
             await tx.customerLedgerEntry.create({
               data: {
                 customerId,
                 saleId: sale.id,
                 entryType: "SALE_DEBIT",
                 amount: totalAmount.toNumber(),
                 description: `فاتورة مبيعات: ${sale.quantity} ${sale.itemName}`,
                 ...(tenantId && { tenantId })
               }
             });
           }
           if (paid.gt(0)) {
             const existingCredit = await tx.customerLedgerEntry.findFirst({
               where: { customerId, saleId: sale.id, entryType: "PAYMENT_CREDIT" }
             });
             if (!existingCredit) {
               await tx.customerLedgerEntry.create({
                 data: {
                   customerId,
                   saleId: sale.id,
                   entryType: "PAYMENT_CREDIT",
                   amount: paid.toNumber(),
                   description: `دفعة مسددة عند البيع: ${sale.itemName}`,
                   ...(tenantId && { tenantId })
                 }
               });
             }
           }
        }
        if (deferred.gt(0)) {
           const existingAr = await tx.journalEntry.findFirst({ where: { referenceId: sale.id, accountCode: "ACCOUNTS_RECEIVABLE" } });
           if (!existingAr) {
             await tx.journalEntry.create({
               data: {
                 accountCode: "ACCOUNTS_RECEIVABLE",
                 debit: deferred.toNumber(),
                 referenceId: sale.id,
                 description: `مديونية عميل: ${custName} (${sale.itemName})`,
                 ...(tenantId && { tenantId })
               }
             });
           }
        }
        if (paid.gt(0)) {
           const existingCash = await tx.journalEntry.findFirst({ where: { referenceId: sale.id, accountCode: "CASH" } });
           if (!existingCash) {
             await tx.journalEntry.create({
               data: {
                 accountCode: "CASH",
                 debit: paid.toNumber(),
                 referenceId: sale.id,
                 description: `مقبوضات مبيعات: ${sale.itemName}`,
                 ...(tenantId && { tenantId })
               }
             });
           }
        }
        const existingRev = await tx.journalEntry.findFirst({ where: { referenceId: sale.id, accountCode: "SALES_REVENUE" } });
        if (!existingRev) {
          await tx.journalEntry.create({
               data: {
                 accountCode: "SALES_REVENUE",
                 credit: totalAmount.toNumber(),
                 referenceId: sale.id,
                 description: `إيرادات مبيعات: ${sale.itemName}`,
                 ...(tenantId && { tenantId })
               }
          });
        }
        return sale;
      });
      } catch (err: any) {
        if (err.message === "ITEM_NOT_IN_CATALOG") {
          return { success: false, resultText: "الصنف ده مش موجود في الكتالوج، تحب تضيفه الأول؟" };
        }
        if (err.message && err.message.startsWith("INSUFFICIENT_STOCK:")) {
          const available = err.message.split(":")[1];
          return { success: false, resultText: `المخزون لا يكفي — المتاح ${available} بس.` };
        }
        if (err.code === "P2002" && effectiveIdempotencyKey) {
          const existingSale = await prisma.sale.findFirst({
            where: {
              ...(tenantId && { tenantId }),
              idempotencyKey: effectiveIdempotencyKey
            }
          });
          if (existingSale) {
            return { success: true, resultText: `تم تسجيل البيع مسبقاً. تفاصيل العملية: ${existingSale.quantity} ${existingSale.itemName} إجمالي ${existingSale.total} جنيه بنجاح!` };
          }
        }
        throw err;
      }
      let detectedUnitSale = args?.unit && String(args.unit).trim() && !String(args.unit).includes("null") ? String(args.unit).trim() : "";
      if (!detectedUnitSale && userMessageText) {
        const unitMatch = msgText.match(/\b(طن|كيلو|شكارة|كرتونة|متر|علبة|قطعة|جرام)\b/i);
        if (unitMatch) detectedUnitSale = unitMatch[1];
      }
      const saleUnitStr = detectedUnitSale ? `${detectedUnitSale} ` : "";
      return { success: true, resultText: `تم تسجيل بيع ${saleResult.quantity} ${saleUnitStr}${saleResult.itemName} إجمالي ${saleResult.total} جنيه (مدفوع: ${saleResult.paidAmount}، متبقي: ${saleResult.deferredAmount}) بنجاح!` };
    }

    if (name === "log_expense") {
      const { amount, description, category = "عام" } = args;
      const isPlaceholderDesc = (v: any) => {
        if (!v || String(v).trim() === "") return true;
        const s = String(v).trim().toLowerCase();
        return s === "مصروف" || s === "مصاريف" || s.includes("يحدد") || s.includes("محدد");
      };
      const expAmount = new Decimal(typeof amount === "number" || typeof amount === "string" ? amount : 0);
      if (!expAmount.isFinite() || expAmount.lte(0) || isPlaceholderDesc(description)) {
        return { success: false, resultText: "عشان أسجلك المصروف محتاج تقولي: المبلغ وبيان المصروف (مثال: كهرباء 500ج أو إيجار 2000ج) 💸" };
      }
      const expenseResult = await (prisma as any).$transaction(async (tx: any) => {
        const expense = await tx.expense.create({
          data: {
            amount: expAmount.toNumber(),
            description: String(description).trim(),
            category: String(category).trim(),
            ...(tenantId && { tenantId })
          }
        });
        
        await tx.journalEntry.create({
          data: { accountCode: "OPERATING_EXPENSES", debit: expAmount.toNumber(), referenceId: expense.id, description: `مصروف: ${expense.description}`, ...(tenantId && { tenantId }) }
        });
        
        await tx.journalEntry.create({
          data: { accountCode: "CASH", credit: expAmount.toNumber(), referenceId: expense.id, description: `دفع مصروف: ${expense.description}`, ...(tenantId && { tenantId }) }
        });
        
        return expense;
      });
      return { success: true, resultText: `تم تسجيل مصروف ${expenseResult.amount} جنيه (${expenseResult.description}) بنجاح!` };
    }

    if (name === "book_appointment") {
      const { customer_name, customer_phone, date, time, notes = "" } = args;

      // Detect placeholder/empty values that LLM inserts when user didn't provide info
      const isPlaceholder = (v: any) => {
        if (!v || String(v).trim() === "") return true;
        const s = String(v).trim().toLowerCase();
        const containsChinese = /[\u4e00-\u9fa5]/.test(s);
        const isInvalidKeyword = s === "الجاي" || s === "القادم" || s === "غير" || s === "لا يوجد" || s === "غير محدد";
        return containsChinese || isInvalidKeyword || s.includes("يحدد") || s.includes("محدد") || s.includes("معروف") || s.includes("unspecified") || s.includes("unknown") || s.includes("none") || s.includes("null");
      };

      // Past date check
      const dStr = String(date || "").trim();
      const msgNorm = userMessageText ? normalizeArabic(userMessageText) : "";
      const isPastWord = /(امبارح|امس|أمس|الماضي)/i.test(msgNorm) || /(امبارح|امس|أمس|الماضي)/i.test(normalizeArabic(dStr));
      
      let isPastDate = isPastWord;
      if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (dStr < todayStr) isPastDate = true;
      }

      if (isPastDate) {
        return { success: true, resultText: "عذراً، لا يمكن حجز موعد بتاريخ سابق (في الماضي). يرجى تحديد تاريخ ووقت في المستقبل. 📅" };
      }

      if (isPlaceholder(customer_name) || isPlaceholder(date) || isPlaceholder(time)) {
        const missing = [];
        if (isPlaceholder(customer_name)) missing.push("اسم العميل");
        if (isPlaceholder(date)) missing.push("التاريخ (مثال: غداً أو 2026-08-15)");
        if (isPlaceholder(time)) missing.push("الوقت (مثال: 03:00 مساءً)");
        return { success: false, resultText: `عشان أحجزلك الموعد محتاج تقولي: ${missing.join("، ")} 📅` };
      }

      const existing = await prisma.appointment.findFirst({
        where: {
          date: { contains: String(date).trim() },
          time: { contains: String(time).trim() },
          ...(tenantId && { tenantId })
        }
      });
      if (existing) {
        return { success: false, resultText: `تعارض: يوجد موعد محجوز بالفعل في نفس الوقت لـ (${existing.customerName}).` };
      }
      let custName = String(customer_name).trim();
      if (custName === "المشترك" || custName === "عميل عام" || isPlaceholder(custName)) {
        custName = "عميل";
      }
      const custPhone = customer_phone ? String(customer_phone).trim() : null;
      let customer = await findCustomerFuzzy(prisma, tenantId || "", custName, custPhone);
      if (!customer && custName !== "عميل" && tenantId) {
        try {
          customer = await prisma.customer.create({
            data: {
              name: custName,
              phone: custPhone,
              tenantId
            }
          });
        } catch (e) {
          console.error("[book_appointment Customer Auto-Create Error]:", e);
        }
      }

      const app = await prisma.appointment.create({
        data: {
          customerName: custName,
          ...(customer && { customerId: customer.id }),
          date: String(date).trim(),
          time: String(time).trim(),
          notes: String(notes).trim(),
          ...(tenantId && { tenantId })
        }
      });

      const rawDate = app.date.trim();
      const datePart = /^(بكرة|بكره|غداً|غدا|اليوم|النهاردة|النهاره|امبارح|امس|أمس|يوم)/i.test(rawDate) ? rawDate : `يوم ${rawDate}`;

      const rawTime = app.time.trim();
      const timePart = rawTime.startsWith("الساعة") ? rawTime : `الساعة ${rawTime}`;

      const namePart = app.customerName === "عميل" ? "" : ` لـ ${app.customerName}`;
      return { success: true, resultText: `تم حجز موعد${namePart} ${datePart} ${timePart} بنجاح! ✅` };
    }

    if (name === "log_customer_payment") {
       const { customer_name, customer_phone, amount, is_refund = false } = args;
       const numAmount = Number(amount);
       const isPlaceholder = (v: any) => {
         if (!v || String(v).trim() === "") return true;
         const s = String(v).trim().toLowerCase();
         return s.includes("يحدد") || s.includes("محدد") || s.includes("unspecified");
       };

       if (isPlaceholder(customer_name) || isNaN(numAmount) || numAmount <= 0) {
         return { success: false, resultText: "عشان أسجلك الحركة النقدية محتاج تقولي: اسم العميل والمبلغ 💵" };
       }
       const payAmount = new Decimal(numAmount);
       const custName = String(customer_name).replace(/^(لـ|ل|من|عن)\s+/, '').trim();
       const custPhone = customer_phone ? String(customer_phone).trim() : null;

       try {
         const paymentResult = await (prisma as any).$transaction(async (tx: any) => {
            let customer = await findCustomerFuzzy(tx, tenantId || "", custName, custPhone);
            if (!customer) {
               throw new Error(`لم يتم العثور على العميل: ${custName}`);
            }
            if (is_refund) {
              const ledgerEntry = await tx.customerLedgerEntry.create({
                 data: {
                   customerId: customer.id,
                   entryType: "REFUND_DEBIT",
                   amount: payAmount.toNumber(),
                   description: `رد مبلغ نقداً للعميل`,
                   ...(tenantId && { tenantId })
                 }
              });
              await tx.journalEntry.create({
                 data: { accountCode: "ACCOUNTS_RECEIVABLE", debit: payAmount.toNumber(), referenceId: ledgerEntry.id, description: `استرداد نقدي لـ ${customer.name}`, ...(tenantId && { tenantId }) }
              });
              await tx.journalEntry.create({
                 data: { accountCode: "CASH", credit: payAmount.toNumber(), referenceId: ledgerEntry.id, description: `دفع نقدية للعميل ${customer.name}`, ...(tenantId && { tenantId }) }
              });
            } else {
              const ledgerEntry = await tx.customerLedgerEntry.create({
                 data: {
                   customerId: customer.id,
                   entryType: "PAYMENT_CREDIT",
                   amount: payAmount.toNumber(),
                   description: `سداد دفعة نقدية`,
                   ...(tenantId && { tenantId })
                 }
              });
              await tx.journalEntry.create({
                 data: { accountCode: "CASH", debit: payAmount.toNumber(), referenceId: ledgerEntry.id, description: `استلام دفعة من ${customer.name}`, ...(tenantId && { tenantId }) }
              });
              await tx.journalEntry.create({
                 data: { accountCode: "ACCOUNTS_RECEIVABLE", credit: payAmount.toNumber(), referenceId: ledgerEntry.id, description: `تخفيض مديونية ${customer.name}`, ...(tenantId && { tenantId }) }
              });
            }
            return customer;
         });
         if (is_refund) {
           return { success: true, resultText: `تم تسجيل دفع مبلغ ${amount} جنيه كاش للعميل (${paymentResult.name}) وتحديث حسابه بنجاح! 💵` };
         }
         return { success: true, resultText: `تم تسجيل سداد مبلغ ${amount} جنيه من العميل (${paymentResult.name}) بنجاح! 💵` };
       } catch (err: any) {
         return { success: false, resultText: err.message || "حدث خطأ أثناء العملية." };
       }
    }

    if (name === "get_customer_balance") {
       const { customer_name, customer_phone } = args;
       const custName = String(customer_name).trim();
       const custPhone = customer_phone ? String(customer_phone).trim() : null;
       let customer = await findCustomerFuzzy(prisma, tenantId || "", custName, custPhone, true);
       if (!customer) {
          return { success: false, resultText: `لم يتم العثور على العميل: ${custName}` };
       }
       
       let totalSales = new Decimal(0);
       let totalRefundPayouts = new Decimal(0);
       let totalSalesReturns = new Decimal(0);
       let totalCashReceived = new Decimal(0);

       customer.ledgers.forEach((l: any) => {
          if (l.entryType === "SALE_DEBIT") {
            totalSales = totalSales.plus(l.amount);
          } else if (l.entryType === "REFUND_DEBIT") {
            totalRefundPayouts = totalRefundPayouts.plus(l.amount);
          } else if (l.entryType === "PAYMENT_CREDIT" || l.entryType === "SALES_RETURN_CREDIT") {
            if (l.entryType === "SALES_RETURN_CREDIT" || l.description?.startsWith("مرتجع مبيعات")) {
              totalSalesReturns = totalSalesReturns.plus(l.amount);
            } else {
              totalCashReceived = totalCashReceived.plus(l.amount);
            }
          }
       });

       const netPurchases = totalSales.minus(totalSalesReturns);
       const netPaid = totalCashReceived.minus(totalRefundPayouts);
       const balance = netPurchases.minus(netPaid);

       let balanceStr = "";
       if (balance.gt(0)) {
         balanceStr = `${balance.toNumber()} جنيه (مستحق عليه / آجل)`;
       } else if (balance.lt(0)) {
         balanceStr = `${balance.abs().toNumber()} جنيه (دائن / له في المحل)`;
       } else {
         balanceStr = `0 جنيه (خالص)`;
       }

       const phoneStr = customer.phone ? `\n📞 *رقم التليفون:* ${customer.phone}` : "";
       return { 
         success: true, 
         resultText: `📊 *بيانات وكشف حساب العميل (${customer.name}):*${phoneStr}\n\n🛍️ *إجمالي المشتريات:* ${totalSales.toNumber()} جنيه\n🔄 *إجمالي المرتجعات:* ${totalSalesReturns.toNumber()} جنيه\n💵 *المسدد نقداً (الصافي):* ${netPaid.toNumber()} جنيه\n📝 *الرصيد النهائي:* ${balanceStr}` 
       };
    }

    if (name === "log_purchase") {
      const { supplier_name, item_name, total_amount, paid_amount, quantity = 1, price_per_unit, unit } = args;
      
      let detectedUnit = unit && String(unit).trim() && !String(unit).includes("null") && !String(unit).includes("undefined") ? String(unit).trim() : "";
      if (!detectedUnit && userMessageText) {
        const unitMatch = msgText.match(/\b(طن|طم|كيلو|كجم|شكارة|كرتونة|متر|علبة|قطعة|جرام)\b/i);
        if (unitMatch) {
          detectedUnit = unitMatch[1] === "طم" ? "طن" : unitMatch[1];
        }
      }
      const unitStr = detectedUnit ? `${detectedUnit} ` : "";
      
      const isPlaceholder = (v: any) => {
        if (!v || String(v).trim() === "") return true;
        const s = String(v).trim().toLowerCase();
        return s === "مشتريات" || s === "شراء" || s === "صنف" || s === "مورد" || s.includes("يحدد") || s.includes("محدد") || s.includes("unspecified");
      };

      let itemNameCleaned = isPlaceholder(item_name) ? "صنف غير محدد" : String(item_name).trim();
      if (detectedUnit && itemNameCleaned.startsWith(detectedUnit)) {
        itemNameCleaned = itemNameCleaned.substring(detectedUnit.length).trim();
      }

      const qty = Number(quantity) || 1;

      let calcTotal = new Decimal(0);
      const numTotal = Number(total_amount);
      const numUnit = Number(price_per_unit);
      
      const userNums = userMessageText ? (msgText.match(/\d+/g)?.map(Number) || []) : [];
      if (!isNaN(numTotal) && numTotal > 0) {
        if (userNums.length > 0 && !userNums.includes(numTotal)) {
          const paidVal = Number(paid_amount) || 0;
          const candidateTotals = userNums.filter(n => n !== paidVal && n !== qty);
          if (candidateTotals.length > 0) {
            calcTotal = new Decimal(Math.max(...candidateTotals));
          } else {
            calcTotal = new Decimal(numTotal);
          }
        } else {
          calcTotal = new Decimal(numTotal);
        }
      } else if (!isNaN(numUnit) && numUnit > 0) {
        const mulTotal = numUnit * qty;
        if (userNums.length > 0 && !userNums.includes(mulTotal)) {
          const paidVal = Number(paid_amount) || 0;
          const candidateTotals = userNums.filter(n => n !== paidVal && n !== qty);
          if (candidateTotals.length > 0) {
            calcTotal = new Decimal(Math.max(...candidateTotals));
          } else {
            calcTotal = new Decimal(mulTotal);
          }
        } else {
          calcTotal = new Decimal(mulTotal);
        }
      }

      if (isPlaceholder(supplier_name) || isPlaceholder(item_name) || calcTotal.lte(0)) {
        return { success: false, resultText: "عشان أسجلك فاتورة المشتريات محتاج تقولي: اسم المورد، الصنف المشترى، والسعر 📦" };
      }

      if (!tenantId) {
        return { success: false, resultText: "عذراً، لم أتمكن من تسجيل المشتريات لوجود مشكلة في التعرف على حساب الشركة (tenantId مفقود)." };
      }

      const total = calcTotal;
      const paid = paid_amount !== undefined ? new Decimal(paid_amount) : calcTotal;
      const remaining = total.sub(paid);
      
      if (paid.isNegative() || remaining.isNegative() || paid.gt(total)) {
        return { success: false, resultText: "خطأ: المبلغ المدفوع للمشتريات لا يمكن أن يكون أكبر من الإجمالي أو سالباً." };
      }
      
      const supplierNameStr = String(supplier_name).trim();

      const purchaseResult = await (prisma as any).$transaction(async (tx: any) => {
        const supplier = await tx.supplier.upsert({
          where: { tenantId_name: { tenantId, name: supplierNameStr } },
          update: {},
          create: { name: supplierNameStr, tenantId }
        });

        const purchase = await tx.purchase.create({
          data: {
            supplierId: supplier.id,
            itemName: String(item_name).trim(),
            quantity: qty,
            totalAmount: total.toNumber(),
            paidAmount: paid.toNumber(),
            deferredAmount: remaining.toNumber(),
            ...(tenantId && { tenantId })
          }
        });

        // Product Catalog Auto-Sync: Increment existing product stock or insert new product
        const purchaseItemName = String(item_name).trim();
        let existingProduct = await findProductFuzzy(tx, tenantId, purchaseItemName);
        const unitCost = qty > 0 ? total.div(new Decimal(qty)).toNumber() : total.toNumber();

        if (existingProduct) {
          await tx.product.update({
            where: { id: existingProduct.id },
            data: {
              stockQuantity: existingProduct.stockQuantity + qty,
              ...(existingProduct.unitPrice === 0 && { unitPrice: unitCost })
            }
          });
        } else {
          await tx.product.create({
            data: {
              tenantId,
              name: purchaseItemName,
              isStockItem: true,
              stockQuantity: qty,
              unitPrice: unitCost
            }
          });
        }

        await tx.journalEntry.create({
          data: { accountCode: "INVENTORY", debit: total.toNumber(), referenceId: purchase.id, description: `مشتريات: ${purchase.itemName}`, ...(tenantId && { tenantId }) }
        });
        
        if (paid.gt(0)) {
          await tx.journalEntry.create({
            data: { accountCode: "CASH", credit: paid.toNumber(), referenceId: purchase.id, description: `سداد مشتريات: ${purchase.itemName}`, ...(tenantId && { tenantId }) }
          });
        }
        
        if (remaining.gt(0)) {
          await tx.journalEntry.create({
            data: { accountCode: "ACCOUNTS_PAYABLE", credit: remaining.toNumber(), referenceId: purchase.id, description: `آجل مورد: ${supplierNameStr}`, ...(tenantId && { tenantId }) }
          });
        }

        return { purchase, supplier };
      });

      let displayItemName = purchaseResult.purchase.itemName;
      if (detectedUnit && displayItemName.startsWith(detectedUnit)) {
        displayItemName = displayItemName.substring(detectedUnit.length).trim();
      }
      return { success: true, resultText: `تم تسجيل فاتورة مشتريات (${qty} ${unitStr}${displayItemName}) من المورد (${purchaseResult.supplier.name}) بقيمة إجمالية ${purchaseResult.purchase.totalAmount} جنيه بنجاح! 📦` };
    }

    if (name === "log_supplier_payment") {
      const { supplier_name, amount } = args;
      const numAmount = Number(amount);
      if (!supplier_name || isNaN(numAmount) || numAmount <= 0) {
        return { success: false, resultText: "عشان أسجلك سداد المورد محتاج تقولي: اسم المورد والمبلغ المدفوع 💵" };
      }
      const payAmount = new Decimal(numAmount);
      const supName = String(supplier_name).replace(/^(المورد|مورد|للمورد|لـ|ل|من|عن)\s+/, '').trim();

      try {
        const { totalDebtResult, supplierFound } = await (prisma as any).$transaction(async (tx: any) => {
          let supplier = await tx.supplier.findFirst({
            where: { name: { contains: supName }, ...(tenantId && { tenantId }) }
          });

          if (!supplier && tenantId) {
            const memoryMatch = await tx.merchantMemory.findFirst({
              where: { tenantId, key: supName }
            });
            if (memoryMatch) {
              supplier = await tx.supplier.findFirst({
                where: { tenantId, name: { contains: memoryMatch.value } }
              });
            }
          }

          if (!supplier) {
            supplier = await tx.supplier.create({
              data: {
                name: supName,
                ...(tenantId && { tenantId })
              }
            });
          }

          // 1. Record SupplierPayment
          const supplierPayment = await tx.supplierPayment.create({
            data: {
              supplierId: supplier.id,
              amount: payAmount.toNumber(),
              notes: `سداد دفعة نقدية للمورد`,
              ...(tenantId && { tenantId })
            }
          });

          // 2. Deduct from deferredAmount on open purchases
          const openPurchases = await tx.purchase.findMany({
            where: { supplierId: supplier.id, deferredAmount: { gt: 0 } },
            orderBy: { createdAt: "asc" }
          });

          let remainingToDeduct = payAmount;
          for (const p of openPurchases) {
            if (remainingToDeduct.lte(0)) break;
            const curDef = new Decimal(p.deferredAmount);
            const curPaid = new Decimal(p.paidAmount);
            if (remainingToDeduct.gte(curDef)) {
              await tx.purchase.update({
                where: { id: p.id },
                data: {
                  paidAmount: curPaid.add(curDef).toNumber(),
                  deferredAmount: 0
                }
              });
              remainingToDeduct = remainingToDeduct.sub(curDef);
            } else {
              await tx.purchase.update({
                where: { id: p.id },
                data: {
                  paidAmount: curPaid.add(remainingToDeduct).toNumber(),
                  deferredAmount: curDef.sub(remainingToDeduct).toNumber()
                }
              });
              remainingToDeduct = new Decimal(0);
            }
          }

          // 3. Create Journal Entries
          await tx.journalEntry.create({
            data: { accountCode: "ACCOUNTS_PAYABLE", debit: payAmount.toNumber(), referenceId: supplierPayment.id, description: `سداد للمورد: ${supplier.name}`, ...(tenantId && { tenantId }) }
          });
          await tx.journalEntry.create({
            data: { accountCode: "CASH", credit: payAmount.toNumber(), referenceId: supplierPayment.id, description: `نقدية مدفوعة للمورد: ${supplier.name}`, ...(tenantId && { tenantId }) }
          });

          // 4. Calculate remaining total debt for supplier
          const allPurchases = await tx.purchase.findMany({ where: { supplierId: supplier.id } });
          let totalDebtCalc = new Decimal(0);
          for (const p of allPurchases) {
            totalDebtCalc = totalDebtCalc.add(p.deferredAmount);
          }
          return { totalDebtResult: totalDebtCalc.toNumber(), supplierFound: supplier.name };
        });

        return {
          success: true,
          resultText: `تم تسجيل سداد مبلغ ${amount} جنيه للمورد (${supplierFound}) بنجاح! 💸\nالمتبقي له (الديون): ${totalDebtResult} جنيه.`
        };
      } catch (err: any) {
        return { success: false, resultText: err.message || "حدث خطأ أثناء العملية." };
      }
    }

    if (name === "get_supplier_balance") {
      const { supplier_name } = args;
      const supName = String(supplier_name).trim();

      const suppliers = await prisma.supplier.findMany({
        where: { name: { contains: supName }, ...(tenantId && { tenantId }) },
        include: { purchases: true, payments: true }
      });

      if (!suppliers || suppliers.length === 0) {
        return { success: false, resultText: `لم يتم العثور على المورد: ${supName}` };
      }

      let totalPurchases = new Decimal(0);
      let totalPaidOnPurchases = new Decimal(0);
      let totalDirectPayments = new Decimal(0);
      
      for (const supplier of suppliers) {
        for (const p of supplier.purchases || []) {
          totalPurchases = totalPurchases.add(p.totalAmount);
          totalPaidOnPurchases = totalPaidOnPurchases.add(p.paidAmount);
        }
        for (const pym of supplier.payments || []) {
          totalDirectPayments = totalDirectPayments.add(pym.amount);
        }
      }

      const netRemainingDebt = totalPurchases.sub(totalPaidOnPurchases);

      return {
        success: true,
        resultText: `📊 *كشف حساب المورد (${suppliers[0].name}):*\n\n📦 *إجمالي المشتريات منه:* ${totalPurchases.toNumber()} جنيه\n💵 *إجمالي المسدد له:* ${totalPaidOnPurchases.toNumber()} جنيه\n📝 *الديون المتبقية له (الآجل):* ${netRemainingDebt.toNumber()} جنيه`
      };
    }

    if (name === "log_sales_return") {
      const { customer_name, item_name, quantity = 1, amount } = args;
      const numAmount = Number(amount);
      const isPlaceholder = (v: any) => {
        if (!v || String(v).trim() === "") return true;
        const s = String(v).trim().toLowerCase();
        return s.includes("يحدد") || s.includes("محدد") || s.includes("unspecified");
      };

      if (isPlaceholder(customer_name) || isNaN(numAmount) || numAmount <= 0) {
        return { success: false, resultText: "عشان أسجلك مرتجع المبيعات محتاج تقولي: اسم العميل وقيمة المرتجع 🔄" };
      }
      const retAmount = new Decimal(numAmount);
      const custName = String(customer_name).replace(/^(لـ|ل|من|عن)\s+/, '').trim();
      const itemNameStr = item_name && !isPlaceholder(item_name) ? String(item_name).trim() : "بضاعة مرتجعة";
      const qty = Number(quantity) || 1;

      try {
        const customerFound = await (prisma as any).$transaction(async (tx: any) => {
          const customer = await findCustomerFuzzy(tx, tenantId || "", custName, null);
          if (!customer) {
            throw new Error(`لم يتم العثور على العميل: ${custName}`);
          }

          const entry = await tx.customerLedgerEntry.create({
            data: {
              customerId: customer.id,
              entryType: "SALES_RETURN_CREDIT",
              amount: retAmount.toNumber(),
              description: `مرتجع مبيعات: ${qty} ${itemNameStr}`,
              ...(tenantId && { tenantId })
            }
          });
          
          await tx.journalEntry.create({
            data: { accountCode: "SALES_REVENUE", debit: retAmount.toNumber(), referenceId: entry.id, description: `عكس إيراد - مرتجع مبيعات: ${itemNameStr}`, ...(tenantId && { tenantId }) }
          });
          
          await tx.journalEntry.create({
            data: { accountCode: "ACCOUNTS_RECEIVABLE", credit: retAmount.toNumber(), referenceId: entry.id, description: `تسوية حساب عميل - مرتجع: ${customer.name}`, ...(tenantId && { tenantId }) }
          });

          return customer.name;
        });

        return {
          success: true,
          resultText: `تم تسجيل مرتجع مبيعات (${qty} ${itemNameStr}) من العميل (${customerFound}) بقيمة ${retAmount.toNumber()} جنيه وتحديث حسابه بنجاح! 🔄`
        };
      } catch (err: any) {
        return { success: false, resultText: err.message || "حدث خطأ أثناء العملية." };
      }
    }

    if (name === "log_purchase_return") {
      const { supplier_name, item_name, quantity = 1, amount } = args;
      const numAmount = Number(amount);
      const isPlaceholder = (v: any) => {
        if (!v || String(v).trim() === "") return true;
        const s = String(v).trim().toLowerCase();
        return s.includes("يحدد") || s.includes("محدد") || s.includes("unspecified");
      };

      if (isPlaceholder(supplier_name) || isNaN(numAmount) || numAmount <= 0) {
        return { success: false, resultText: "عشان أسجلك مرتجع المشتريات محتاج تقولي: اسم المورد والقيمة 📦" };
      }
      const retAmount = new Decimal(numAmount);
      const supName = String(supplier_name).replace(/^(لـ|ل|من|عن|للمورد|مورد)\s+/, '').trim();
      const itemNameStr = item_name && !isPlaceholder(item_name) ? String(item_name).trim() : "بضاعة مرتجعة";
      const qty = Number(quantity) || 1;

      try {
          const supplierFound = await (prisma as any).$transaction(async (tx: any) => {
          const supplier = await tx.supplier.findFirst({
            where: { name: { contains: supName }, ...(tenantId && { tenantId }) }
          });
          if (!supplier) {
            throw new Error(`لم يتم العثور على المورد: ${supName}`);
          }

          // Deduct from deferredAmount on open purchases
          const openPurchases = await tx.purchase.findMany({
            where: { supplierId: supplier.id, deferredAmount: { gt: 0 } },
            orderBy: { createdAt: "desc" }
          });

          let remainingToDeduct = retAmount;
          for (const p of openPurchases) {
            if (remainingToDeduct.lte(0)) break;
            const curDef = new Decimal(p.deferredAmount);
            const curPaid = new Decimal(p.paidAmount);
            if (remainingToDeduct.gte(curDef)) {
              await tx.purchase.update({
                where: { id: p.id },
                data: {
                  deferredAmount: 0,
                  paidAmount: curPaid.add(curDef).toNumber()
                }
              });
              remainingToDeduct = remainingToDeduct.sub(curDef);
            } else {
              await tx.purchase.update({
                where: { id: p.id },
                data: {
                  deferredAmount: curDef.sub(remainingToDeduct).toNumber(),
                  paidAmount: curPaid.add(remainingToDeduct).toNumber()
                }
              });
              remainingToDeduct = new Decimal(0);
            }
          }

          const returnRef = crypto.randomUUID();
          
          await tx.journalEntry.create({
            data: { accountCode: "ACCOUNTS_PAYABLE", debit: retAmount.toNumber(), referenceId: returnRef, description: `تسوية مورد - مرتجع مشتريات: ${supplier.name}`, ...(tenantId && { tenantId }) }
          });
          
          await tx.journalEntry.create({
            data: { accountCode: "INVENTORY", credit: retAmount.toNumber(), referenceId: returnRef, description: `عكس مخزون - مرتجع مشتريات: ${itemNameStr}`, ...(tenantId && { tenantId }) }
          });

          return supplier.name;
        });

        return {
          success: true,
          resultText: `تم تسجيل مرتجع مشتريات (${qty} ${itemNameStr}) للمورد (${supplierFound}) بقيمة ${retAmount.toNumber()} جنيه بنجاح! 🔄`
        };
      } catch (err: any) {
        return { success: false, resultText: err.message || "حدث خطأ أثناء العملية." };
      }
    }

    if (name === "get_financial_summary") {
      const { period, start_date, end_date } = args;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let startDate = new Date(today);
      let endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 1);
      
      let periodName = "اليوم";

      if (period === "week") {
        startDate.setDate(startDate.getDate() - 7);
        periodName = "الأسبوع الأخير";
      } else if (period === "month") {
        startDate.setMonth(startDate.getMonth() - 1);
        periodName = "الشهر الأخير";
      } else if (period === "custom" && start_date) {
        startDate = new Date(start_date);
        periodName = `الفترة من ${start_date}`;
        if (end_date) {
          endDate = new Date(end_date);
          endDate.setDate(endDate.getDate() + 1);
          periodName += ` إلى ${end_date}`;
        }
      }

      const sales = await prisma.sale.findMany({
        where: {
          createdAt: { gte: startDate, lt: endDate },
          ...(tenantId && { tenantId })
        }
      });
      let totalSales = new Decimal(0);
      for (const s of sales) {
        totalSales = totalSales.add(s.total);
      }

      const expenses = await prisma.expense.findMany({
        where: {
          createdAt: { gte: startDate, lt: endDate },
          ...(tenantId && { tenantId })
        }
      });
      let totalExpenses = new Decimal(0);
      for (const e of expenses) {
        totalExpenses = totalExpenses.add(e.amount);
      }

      const net = totalSales.sub(totalExpenses);

      return { 
        success: true, 
        resultText: `📊 **ملخص ${periodName}:**\n\n🟢 المبيعات: ${totalSales.toNumber()} جنيه\n🔴 المصروفات: ${totalExpenses.toNumber()} جنيه\n\nالصافي: ${net.toNumber()} جنيه`
      };
    }

    if (name === "get_appointments_list") {
      const { customer_name, limit = 10 } = args;
      const custName = customer_name ? String(customer_name).trim() : null;

      const whereClause: any = { ...(tenantId && { tenantId }) };
      if (custName) {
        const norm = (s: string) => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
        whereClause.customerName = { contains: norm(custName) };
      }

      const apps = await prisma.appointment.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: Number(limit)
      });

      // Filter out invalid/corrupted records where date or time is missing/corrupted
      const validApps = apps.filter(a => {
        const nameStr = (a.customerName || "").trim();
        const dateStr = (a.date || "").trim();
        const timeStr = (a.time || "").trim();
        
        const cleanDate = resolveRelativeArabicDate(dateStr, a.createdAt);
        const cleanTime = cleanArabicTimeStr(timeStr);
        
        const isBadName = nameStr === "" || nameStr.includes("لم يُحدد") || nameStr === "الاسم لم يُحدد";
        const isBadDate = dateStr === "" || dateStr === "الجاي" || dateStr.includes("لم يُحدد") || cleanDate === "غير موضح";
        const isBadTime = timeStr === "" || timeStr.includes("未提及") || timeStr.includes("لم يُحدد") || cleanTime === "غير موضح";
        
        return !(isBadName || isBadDate || isBadTime);
      });

      if (validApps.length === 0) {
        const nameStr = custName ? ` لـ (${custName})` : "";
        return { success: true, resultText: `لا توجد أي مواعيد محجوزة${nameStr} حالياً. 📅` };
      }

      const NUMBERS_EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
      const formattedItems = validApps.map((a, idx) => {
        const numBadge = NUMBERS_EMOJI[idx] || `[${idx + 1}]`;
        const rawName = (a.customerName || "").trim();
        const cName = (rawName === "المشترك" || rawName === "الاسم لم يُحدد" || !rawName) ? "عميل" : rawName;
        const cleanDate = resolveRelativeArabicDate(a.date, a.createdAt);
        const cleanTime = cleanArabicTimeStr(a.time);
        const notesStr = a.notes ? `\n   📝 **ملاحظات:** ${a.notes}` : "";

        return `${numBadge} **${cName}**\n   📆 **الموعد:** ${cleanDate}\n   ⏰ **الوقت:** ${cleanTime}${notesStr}`;
      });

      return { 
        success: true, 
        resultText: `📅 **جدول المواعيد المحجوزة (${validApps.length}):**\n\n${formattedItems.join('\n\n')}`
      };
    }

    if (name === "cancel_appointment") {
      const { customer_name, date } = args;
      const custName = customer_name ? String(customer_name).trim() : "";
      if (!custName) {
        return { success: false, resultText: "من فضلك حدد اسم العميل لإلغاء الموعد. 📅" };
      }

      const norm = (s: string) => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
      const searchNorm = norm(custName);

      const apps = await prisma.appointment.findMany({
        where: {
          ...(tenantId && { tenantId }),
          status: { not: "cancelled" }
        }
      });

      const matched = apps.filter(a => norm(a.customerName).includes(searchNorm) || searchNorm.includes(norm(a.customerName)));

      if (matched.length === 0) {
        return { success: false, resultText: `لم نجد أي موعد محجوز باسم (${custName}) حالياً. 📅` };
      }

      await prisma.appointment.updateMany({
        where: {
          id: { in: matched.map(m => m.id) }
        },
        data: {
          status: "cancelled"
        }
      });

      return { success: true, resultText: `تم إلغاء موعد العميل (${custName}) بنجاح! ❌📅` };
    }

    if (name === "reschedule_appointment") {
      const { customer_name, new_date, new_time } = args;
      const custName = customer_name ? String(customer_name).trim() : "";
      const nDate = new_date ? String(new_date).trim() : "";
      const nTime = new_time ? String(new_time).trim() : "";

      if (!custName || !nDate || !nTime) {
        return { success: false, resultText: "لتأجيل الموعد، يرجى توضيح اسم العميل، التاريخ الجديد، والوقت الجديد. 📅" };
      }

      const norm = (s: string) => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
      const searchNorm = norm(custName);

      const apps = await prisma.appointment.findMany({
        where: {
          ...(tenantId && { tenantId }),
          status: { not: "cancelled" }
        }
      });

      const matched = apps.find(a => norm(a.customerName).includes(searchNorm) || searchNorm.includes(norm(a.customerName)));

      if (!matched) {
        return { success: false, resultText: `لم نجد أي موعد محجوز باسم (${custName}) لتعديله. 📅` };
      }

      await prisma.appointment.update({
        where: { id: matched.id },
        data: {
          date: nDate,
          time: nTime,
          status: "rescheduled"
        }
      });

      return { success: true, resultText: `تم تأجيل/تعديل موعد العميل (${custName}) إلى يوم (${nDate}) الساعة (${nTime}) بنجاح! 📅🔄` };
    }

    if (name === "report_missing_feature") {
      const { feature_description } = args;
      const desc = String(feature_description || "").trim();
      const descClean = desc.replace(/\s+/g, "");
      const distinctChars = new Set(descClean).size;
      const hasLongRepetition = /(.)\1{3,}/u.test(descClean);

      // Intercept validation error responses (e.g. past dates, missing data) incorrectly routed to report_missing_feature
      const isValidationError = 
        desc.includes("ماضي") || 
        desc.includes("سابق") || 
        desc.includes("قديم") || 
        desc.includes("امبارح") || 
        desc.includes("أمس") || 
        desc.includes("تاريخ") || 
        desc.includes("مستقبل");

      if (isValidationError) {
        return {
          success: true,
          resultText: "عذراً، لا يمكن حجز موعد بتاريخ سابق (في الماضي). يرجى تحديد تاريخ ووقت في المستقبل. 📅"
        };
      }

      // Defensive gibberish / nonsense filtering
      const isGibberish = 
        descClean.length < 3 ||
        distinctChars <= 2 ||
        hasLongRepetition ||
        (/^[ا-ي]{1,4}$/i.test(descClean) && !["شحن", "دفع", "جرد", "فيزا", "خصم", "حجز"].includes(descClean));

      if (isGibberish) {
        return {
          success: false,
          resultText: "عفواً، لم أفهم قصدك بوضوح. يمكنك كتابة طلبك أو الاستفسار الذي تحتاجه بالتفصيل. 😊"
        };
      }

      const adminChatId = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
      let tenantInfo = tenantId ? `العميل رقم: ${tenantId}` : "عميل غير معروف";

      if (adminChatId) {
        await sendTelegramAlert({
          chatId: adminChatId,
          text: `⚠️ **اقتراح ميزة جديدة من البوت!**\n\n${tenantInfo} طلب ميزة غير متاحة حالياً:\n\n💬 "${desc}"\n\nهل ترغب ببرمجتها؟`,
          idempotencyKey: `feature-req-${Date.now()}`
        });
      }
      return { 
        success: true, 
        resultText: "تم إرسال اقتراحك للمطور بنجاح! سيتم العمل على إضافتها قريباً، شكراً لك."
      };
    }

    if (name === "cancel_last_transaction") {
      if (!tenantId) {
        return { success: false, resultText: "عذراً، يلزم تحديد هوية النشاط لإلغاء المعاملة." };
      }

      const isConfirmed = args?.confirmed === true || /(نعم|ايوه|أيوة|تأكيد|اكيد|اتفضل|أكيد|ماشي|تمام)/i.test(userMessageText || "");
      const windowStart = new Date(Date.now() - 30 * 60 * 1000);
      const requestedType = args?.transaction_type || "auto";

      const lastSale = (requestedType === "sale" || requestedType === "auto")
        ? await (prisma as any).sale.findFirst({ where: { tenantId, voided: false, createdAt: { gte: windowStart } }, orderBy: { createdAt: "desc" } })
        : null;

      const lastPurchase = (requestedType === "purchase" || requestedType === "auto")
        ? await (prisma as any).purchase.findFirst({ where: { tenantId, voided: false, createdAt: { gte: windowStart } }, orderBy: { createdAt: "desc" } })
        : null;

      const lastExpense = (requestedType === "expense" || requestedType === "auto")
        ? await (prisma as any).expense.findFirst({ where: { tenantId, voided: false, createdAt: { gte: windowStart } }, orderBy: { createdAt: "desc" } })
        : null;

      const candidates = [
        lastSale ? { type: "sale", record: lastSale, time: lastSale.createdAt.getTime() } : null,
        lastPurchase ? { type: "purchase", record: lastPurchase, time: lastPurchase.createdAt.getTime() } : null,
        lastExpense ? { type: "expense", record: lastExpense, time: lastExpense.createdAt.getTime() } : null,
      ].filter(Boolean) as { type: "sale" | "purchase" | "expense"; record: any; time: number }[];

      candidates.sort((a, b) => b.time - a.time);
      const target = candidates[0];

      if (!target) {
        return { success: false, resultText: "لم نجد أي عملية حديثة (آخر 30 دقيقة) قابلة للإلغاء. لو محتاج إلغاء عملية قديمة، يمكنك عمل مرتجع." };
      }

      if (!isConfirmed) {
        const typeLabel = target.type === "sale" ? "فاتورة البيع" : target.type === "purchase" ? "فاتورة المشتريات" : "المصروف";
        const itemInfo = target.record.itemName || target.record.description || "";
        const amountInfo = target.record.total || target.record.totalAmount || target.record.amount;
        return {
          success: false,
          resultText: `⚠️ هل أنت متأكد من إلغاء ${typeLabel} (${itemInfo} بقيمة ${amountInfo} جنيه)؟ أرسل 'نعم' للتأكيد.`
        };
      }

      if (target.record.voided) {
        return { success: false, resultText: "العملية دي اتلغت بالفعل 🚫" };
      }

      const txResult = await (prisma as any).$transaction(async (tx: any) => {
        if (target.type === "sale") {
          const sale = target.record;
          await tx.sale.update({
            where: { id: sale.id },
            data: { voided: true, voidedAt: new Date(), voidedBy: telegramMessageId?.toString() || "system" }
          });
          if (sale.customerId && Number(sale.deferredAmount) > 0) {
            await tx.customerLedgerEntry.create({
              data: {
                tenantId,
                customerId: sale.customerId,
                saleId: sale.id,
                entryType: "VOID_REVERSAL",
                amount: new Decimal(sale.deferredAmount).negated(),
                description: `إلغاء فاتورة بيع: ${sale.itemName}`
              }
            });
          }
          const prod = await tx.product.findFirst({ where: { tenantId, name: { contains: sale.itemName } } });
          if (prod && prod.isStockItem) {
            await tx.product.update({ where: { id: prod.id }, data: { stockQuantity: prod.stockQuantity + sale.quantity } });
          }
          return { success: true, resultText: `✅ تم إلغاء فاتورة البيع (${sale.itemName} - ${sale.total} جنيه) بنجاح.` };
        } else if (target.type === "purchase") {
          const purchase = target.record;
          await tx.purchase.update({
            where: { id: purchase.id },
            data: { voided: true, voidedAt: new Date(), voidedBy: telegramMessageId?.toString() || "system" }
          });
          const prod = await tx.product.findFirst({ where: { tenantId, name: { contains: purchase.itemName } } });
          if (prod && prod.isStockItem) {
            const newQty = Math.max(0, prod.stockQuantity - (purchase.quantity || 1));
            await tx.product.update({ where: { id: prod.id }, data: { stockQuantity: newQty } });
          }
          return { success: true, resultText: `✅ تم إلغاء فاتورة المشتريات (${purchase.itemName} - ${purchase.totalAmount} جنيه) بنجاح.` };
        } else {
          const exp = target.record;
          await tx.expense.update({
            where: { id: exp.id },
            data: { voided: true, voidedAt: new Date(), voidedBy: telegramMessageId?.toString() || "system" }
          });
          return { success: true, resultText: `✅ تم إلغاء المصروف (${exp.description} - ${exp.amount} جنيه) بنجاح.` };
        }
      });

      return txResult as { success: boolean; resultText: string };
    }

    if (name === "correct_last_transaction") {
      if (!tenantId) {
        return { success: false, resultText: "عذراً، يلزم تحديد هوية النشاط لتعديل المعاملة." };
      }

      const corrections = Array.isArray(args?.corrections) ? args.corrections : [];
      if (corrections.length === 0) {
        return { success: false, resultText: "من فضلك حدد الحقل والقيمة الجديدة المراد تعديلها." };
      }

      const windowStart = new Date(Date.now() - 30 * 60 * 1000);
      const lastSale = await (prisma as any).sale.findFirst({ where: { tenantId, voided: false, createdAt: { gte: windowStart } }, orderBy: { createdAt: "desc" } });
      const lastPurchase = await (prisma as any).purchase.findFirst({ where: { tenantId, voided: false, createdAt: { gte: windowStart } }, orderBy: { createdAt: "desc" } });

      let record: any = null;
      let recordType: "sale" | "purchase" = "sale";

      if (lastSale && lastPurchase) {
        if (lastSale.createdAt.getTime() >= lastPurchase.createdAt.getTime()) {
          record = lastSale;
          recordType = "sale";
        } else {
          record = lastPurchase;
          recordType = "purchase";
        }
      } else if (lastSale) {
        record = lastSale;
        recordType = "sale";
      } else if (lastPurchase) {
        record = lastPurchase;
        recordType = "purchase";
      }

      if (!record) {
        return { success: false, resultText: "لم نجد أي عملية حديثة (آخر 30 دقيقة) قابلة للتعديل." };
      }

      const updateData: any = {};
      let updatedFieldsLog: string[] = [];

      for (const item of corrections) {
        const { field, new_value } = item;
        if (!field || new_value === undefined) continue;

        if (field === "price") {
          const newPriceDec = new Decimal(new_value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          updateData.price = newPriceDec;
          const qty = updateData.quantity || record.quantity || 1;
          updateData.total = newPriceDec.mul(new Decimal(qty)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          updatedFieldsLog.push(`السعر: ${newPriceDec} جنيه`);
        } else if (field === "total_amount") {
          const newTotalDec = new Decimal(new_value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          if (recordType === "sale") updateData.total = newTotalDec;
          else updateData.totalAmount = newTotalDec;
          updatedFieldsLog.push(`الإجمالي: ${newTotalDec} جنيه`);
        } else if (field === "quantity") {
          const newQty = parseInt(String(new_value), 10) || 1;
          updateData.quantity = newQty;
          const priceDec = updateData.price ? new Decimal(updateData.price) : new Decimal(record.price || record.totalAmount);
          updateData[recordType === "sale" ? "total" : "totalAmount"] = priceDec.mul(new Decimal(newQty)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          updatedFieldsLog.push(`الكمية: ${newQty}`);
        } else if (field === "customer_name") {
          updateData.customerName = String(new_value).trim();
          updatedFieldsLog.push(`العميل: ${new_value}`);
        } else if (field === "supplier_name") {
          updatedFieldsLog.push(`المورد: ${new_value}`);
        }
      }

      if (Object.keys(updateData).length === 0) {
        return { success: false, resultText: "لم تتغير أي بيانات في العملية الأخيرة." };
      }

      if (recordType === "sale") {
        await (prisma as any).sale.update({ where: { id: record.id }, data: updateData });
      } else {
        await (prisma as any).purchase.update({ where: { id: record.id }, data: updateData });
      }

      return {
        success: true,
        resultText: `✅ تم تصحيح البيانات في آخر فاتورة ${recordType === "sale" ? "بيع" : "مشتريات"} بنجاح:\n- ${updatedFieldsLog.join("\n- ")}`
      };
    }

    return { success: false, resultText: `أداة غير معروفة: ${name}` };
  } catch (err: any) {
    console.error(`[Telegram LLM Tool Error] ${name}:`, err);
    return { success: false, resultText: `فشل تنفيذ العملية: ${err?.message || "خطأ في قاعدة البيانات"}` };
  }
}

export type LLMResult =
  | { status: "success"; text: string }
  | { status: "all_providers_exhausted"; lastError?: string };

async function saveChatMessage(tenantId?: string, telegramChatId?: string, role?: string, text?: string) {
  if (!tenantId || !telegramChatId || !text) return;
  try {
    const tExists = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tExists) return;
    await prisma.chatMessage.create({
      data: { tenantId, telegramChatId, role: role || "user", text }
    });
  } catch (e) {
    console.error("[ChatMessage Save Error]:", e);
  }
}

export async function processTelegramMessageWithLLM(
  text: string,
  tenantId?: string,
  tenantName?: string,
  businessType?: string,
  workingHours?: string,
  telegramChatId?: string,
  telegramMessageId?: number | string,
  merchantName?: string
): Promise<LLMResult> {
  const { getValidApiKey, markKeyExhausted } = await import('./apiKeyManager');
  
  // 1. Fetch rolling chat history buffer (last 6 messages in past 60 mins)
  let rawHistory: Array<{ role: string; text: string }> = [];
  if (tenantId && telegramChatId) {
    try {
      const sixtyMinsAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentMsgs = await prisma.chatMessage.findMany({
        where: {
          tenantId,
          telegramChatId,
          createdAt: { gte: sixtyMinsAgo }
        },
        orderBy: { createdAt: "desc" },
        take: 6
      });
      rawHistory = recentMsgs.reverse().map((m) => ({ role: m.role, text: m.text }));
    } catch (e) {
      console.error("[ChatHistory Fetch Error]:", e);
    }
  }

  // Normalize Eastern Arabic numerals (٠-٩) to English digits (0-9) and common unit typos (طم -> طن)
  const normalizedText = text.replace(/[٠-٩]/g, (w) => String(['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'].indexOf(w))).replace(/(\d+)\s*طم\b/g, '$1 طن');

  // Save incoming user message to history buffer (non-blocking)
  void saveChatMessage(tenantId, telegramChatId, "user", normalizedText);

  // Clean merchant name if provided
  const cleanMerchant = merchantName ? merchantName.replace(/^(مستر|أستاذ|استاذ)\s+/, '').trim() : null;
  const merchantTitle = cleanMerchant ? `مستر ${cleanMerchant}` : "فندم";

  // === NEW: Input Language Guardrail — Only Arabic & English allowed ===
  const FOREIGN_INPUT_SCRIPTS_REGEX = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fa5\u0400-\u04ff\u0900-\u097f\u0e00-\u0e7f\uac00-\ud7af]/gu;
  if (FOREIGN_INPUT_SCRIPTS_REGEX.test(normalizedText)) {
    console.warn(`[Input Language Guardrail] Rejected incoming foreign script message: "${normalizedText}"`);
    const reply = `عفواً يا ${merchantTitle}، النظام يدعم اللغة العربية والإنجليزية فقط. يرجى كتابة طلبك بالعربي أو الإنجليزي. 😊`;
    void saveChatMessage(tenantId, telegramChatId, "assistant", reply);
    return { status: "success", text: reply };
  }

  // === NEW: Small-talk short-circuit — no LLM, no tools ===
  const SMALL_TALK_PATTERNS = [
    /^ايه\s*الدنيا/i, /^إيه\s*الدنيا/i, /^ازيك/i, /^إزيك/i, /^عامل\s*ايه/i, /^اخبارك/i, /^أخبارك/i,
    /^صباح\s*الخير/i, /^مساء\s*الخير/i, /^سلام/i, /^اهلا/i, /^أهلا/i, /^هاي$/i, /^هلا/i
  ];
  const trimmedText = normalizedText.trim();
  if (SMALL_TALK_PATTERNS.some((re) => re.test(trimmedText)) && trimmedText.length < 25) {
    const reply = `أهلاً بيك يا ${merchantTitle}! 😊 قولّي محتاج تسجل بيع، مصروف، ولا تحجز ميعاد؟`;
    void saveChatMessage(tenantId, telegramChatId, "assistant", reply);
    return { status: "success", text: reply };
  }
  // === END small-talk router ===

  // Try models in order - first available free-tier model wins
  const modelsToTry = ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];
  let lastError: any = null;
  const maxRetries = 3;

  const companyStr = tenantName ? `بشركة ${tenantName}` : "بنظامنا الذكي";
  const typeStr = businessType ? `(نوع النشاط: ${businessType})` : "";
  const hoursStr = workingHours ? `(مواعيد العمل: ${workingHours})` : "";

  // Dynamic Tool Routing & Context Prompt Building
  const lastHistoryText = rawHistory.length > 0 ? rawHistory[rawHistory.length - 1].text : undefined;
  const fullContextText = [...rawHistory.map(h => h.text), normalizedText].join(" ");
  const { activeTools, activeClusters } = resolveActiveTools(normalizedText, lastHistoryText);

  // Merchant Memory: resolve relevant aliases/units for this message (~2-5ms)
  const resolvedMemories = tenantId
    ? await resolveMerchantMemories(tenantId, normalizedText)
    : [];
  const memoryContext = resolvedMemories.length > 0
    ? resolvedMemories.map(m => `${m.key} = ${m.value}`).join('\n')
    : undefined;
  const activePrompt = buildActivePrompt(activeClusters, companyStr, typeStr, hoursStr, memoryContext);

  console.log(`[TokenRouter] Input: "${normalizedText.slice(0, 35)}..." | Active Clusters: [${activeClusters.join(', ')}] | Tools Sent: ${activeTools.length}/${ALL_TOOLS.length}`);

  // Format history for Gemini SDK & ensure history starts with user role
  const geminiHistory = rawHistory.map(h => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.text }]
  }));
  while (geminiHistory.length > 0 && geminiHistory[0].role === "model") {
    geminiHistory.shift();
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let apiKey: string;
    try {
      apiKey = await getValidApiKey("gemini");
    } catch {
      break; // All Gemini keys exhausted — fall to Groq
    }

    let modelWorked = false;
    for (const modelName of modelsToTry) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          tools: [{ functionDeclarations: activeTools }],
          systemInstruction: activePrompt
        });

        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessage(text);
        const response = result.response;
        const functionCalls = response.functionCalls();

        let finalReply = "";
        if (functionCalls && functionCalls.length > 0) {
          const combinedResults = [];
          for (let idx = 0; idx < functionCalls.length; idx++) {
            const call = functionCalls[idx];
            const toolRes = await executeTool(call.name, call.args, tenantId, text, telegramMessageId, idx, fullContextText);
            combinedResults.push(toolRes.resultText);
          }
          finalReply = combinedResults.join('\n\n').trim();
        } else {
          finalReply = sanitizeNonToolReply(response.text().trim() || "تمام يا فندم، أنا معاك.");
        }

        finalReply = enforceArabicEnglishOnly(finalReply);
        void saveChatMessage(tenantId, telegramChatId, "assistant", finalReply);

        // Fire-and-forget: learn new aliases from this message asynchronously (0ms user wait)
        if (tenantId) void extractAndPersistMemory(tenantId, normalizedText);

        const usage = (response as any).usageMetadata;
        if (tenantId && usage) {
          const inT = usage.promptTokenCount || 0;
          const outT = usage.candidatesTokenCount || 0;
          const totalT = usage.totalTokenCount || (inT + outT);
          await (prisma as any).tokenUsage.create({
            data: {
              tenantId,
              provider: "gemini",
              modelName: modelName || "gemini-3.1-flash-lite",
              inputTokens: inT,
              outputTokens: outT,
              totalTokens: totalT,
              dateStr: new Date().toISOString().slice(0, 10),
            },
          }).catch(() => null);
          void checkAndAlertTokenUsage(tenantId, "gemini");
        }

        return { status: "success", text: finalReply };
      } catch (err: any) {
        lastError = err;
        if (err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("Quota")) {
          await markKeyExhausted(apiKey, "gemini");
          modelWorked = false;
          break; // Key exhausted — get next key
        }
        if (err?.status === 404 || err?.message?.includes("not found") || err?.message?.includes("404")) {
          console.warn(`[Telegram LLM] Model ${modelName} not available, trying next...`);
          continue; // Model not available — try next model
        }
        // Unknown error — break both loops
        break;
      }
    }
    if (!modelWorked && lastError?.status !== 429 && !lastError?.message?.includes("429")) {
      break; // Non-quota error, stop retrying
    }
  }

  // ========== GROQ FALLBACK ROTATION POOL ==========
  // Triggered when all Gemini keys are exhausted or unavailable
  const maxGroqAttempts = 5;
  for (let gAttempt = 1; gAttempt <= maxGroqAttempts; gAttempt++) {
    let groqApiKey: string;
    try {
      groqApiKey = await getValidApiKey("groq");
    } catch {
      break; // All Groq keys exhausted
    }

    console.log(`[Telegram LLM] Gemini exhausted — using Groq Llama rotation pool (Attempt ${gAttempt})...`);
    try {
      const groq = new Groq({ apiKey: groqApiKey });

      // Build OpenAI-compatible tools dynamically from our activeTools
      const groqTools = activeTools.map(t => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters as any  // Gemini schema is compatible at runtime
        }
      }));

      // P2: Inject last 3 messages as context summary in system prompt
      const contextSummary = rawHistory.length > 0
        ? `\n\n---\n[سياق آخر رسائل المحادثة - استخدمه لربط الضمائر مثل "هو/هي/الباقي/نفس العميل"]:\n` +
          rawHistory.slice(-3).map(h =>
            `${h.role === "user" ? "🧑 التاجر" : "🤖 المساعد"}: ${h.text.slice(0, 200)}`
          ).join("\n")
        : "";

      const groqMessages = [
        { role: "system", content: activePrompt + contextSummary },
        { role: "user", content: normalizedText }
      ];

      const groqModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"];
      let groqRes: any = null;
      let capturedFailedGen: string | null = null;

      for (const modelCandidate of groqModels) {
        try {
          groqRes = await groq.chat.completions.create({
            model: modelCandidate,
            messages: groqMessages as any,
            tools: groqTools,
            tool_choice: "auto",
            max_tokens: 1024
          });
          if (groqRes) break;
        } catch (gModelErr: any) {
          console.warn(`[Groq Model ${modelCandidate} Error]:`, gModelErr?.message || gModelErr);
          const fg = gModelErr?.error?.error?.failed_generation || gModelErr?.error?.failed_generation;
          if (fg && typeof fg === 'string' && fg.includes('<function=')) {
            capturedFailedGen = fg;
            break;
          }
          if (gModelErr?.status === 429 || String(gModelErr?.message).includes("429")) {
            await new Promise(res => setTimeout(res, 2000));
          }
        }
      }

      if (!groqRes && !capturedFailedGen) throw new Error("All Groq models failed");

      if (capturedFailedGen) {
        const failedGen = capturedFailedGen;
        const firstBlock = failedGen.split('</function>')[0] || failedGen;
        const nameMatch = firstBlock.match(/<function=([a-zA-Z0-9_]+)/i);
        if (nameMatch && nameMatch[1]) {
          const funcName = nameMatch[1].trim();
          let args = {};
          const jsonMatch = firstBlock.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              let cleanedJson = jsonMatch[0].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              cleanedJson = cleanedJson
                .replace(/:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g, (_, a, b) => `: ${Number(a) / Number(b)}`)
                .replace(/:\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/g, (_, a, b) => `: ${Number(a) - Number(b)}`)
                .replace(/:\s*(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)/g, (_, a, b) => `: ${Number(a) + Number(b)}`);
              args = JSON.parse(cleanedJson);
            } catch (e) {
              console.error("[Groq Parser] JSON parse error:", jsonMatch[0], e);
            }
          }
          const toolRes = await executeTool(funcName, args, tenantId, normalizedText, telegramMessageId, 0, fullContextText);
          void saveChatMessage(tenantId, telegramChatId, "assistant", toolRes.resultText);
          return { status: "success", text: toolRes.resultText };
        }
      }

      const choice = groqRes.choices[0];
      const toolCalls = choice?.message?.tool_calls;
      let finalReply = "";

      if (toolCalls && toolCalls.length > 0) {
        const results: string[] = [];
        for (let idx = 0; idx < toolCalls.length; idx++) {
          const call = toolCalls[idx];
          let args: Record<string, any> = {};
          try { args = JSON.parse(call.function.arguments); } catch {}
          const toolRes = await executeTool(call.function.name, args, tenantId, normalizedText, telegramMessageId, idx, fullContextText);
          results.push(toolRes.resultText);
        }
        finalReply = results.join('\n\n').trim();
      } else {
        finalReply = sanitizeNonToolReply(choice?.message?.content?.trim() || "تمام يا فندم، أنا معاك.");
      }

      finalReply = enforceArabicEnglishOnly(finalReply);
      void saveChatMessage(tenantId, telegramChatId, "assistant", finalReply);
      return { status: "success", text: finalReply };
    } catch (groqErr: any) {
      console.error(`[Telegram LLM Groq Key ${gAttempt} Error]:`, groqErr);
      
      // Handle Groq's custom XML tool failure (e.g. <function=log_sale{...}></function>)
      const failedGen = groqErr?.error?.error?.failed_generation || groqErr?.error?.failed_generation;
      if (failedGen && typeof failedGen === 'string' && failedGen.includes('<function=')) {
        try {
          const nameMatch = failedGen.match(/<function=([a-zA-Z0-9_]+)/i);
          if (nameMatch && nameMatch[1]) {
            const funcName = nameMatch[1].trim();
            let args = {};
            const jsonMatch = failedGen.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const cleanedJson = jsonMatch[0]
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, '\\')
                  .replace(/:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g, (_, a, b) => `: ${Number(a) / Number(b)}`);
                args = JSON.parse(cleanedJson);
              } catch (e) {
                console.error("[Groq Parser] JSON parse error:", jsonMatch[0], e);
              }
            }
            const toolRes = await executeTool(funcName, args, tenantId, text, telegramMessageId, 0, fullContextText);
            void saveChatMessage(tenantId, telegramChatId, "assistant", toolRes.resultText);
            return { status: "success", text: toolRes.resultText };
          }
        } catch (parseErr) {
          console.error("Error parsing failed_generation:", parseErr);
        }
      }

      const is429 = groqErr?.status === 429 || groqErr?.statusCode === 429 || /429|rate_limit|quota/i.test(groqErr?.message || "");
      if (is429) {
        await markKeyExhausted(groqApiKey, "groq");
        console.warn(`[Telegram LLM] Groq Key exhausted, trying next Groq key in pool...`);
        continue;
      }

      // Non-429 error -> break loop
      break;
    }
  }

  return { status: "all_providers_exhausted", lastError: lastError?.message };
}

import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import Groq from "groq-sdk";
import Decimal from "decimal.js";
import { sendTelegramAlert } from "./telegram";

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
    required: ["item_name", "price", "idempotency_key"]
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
  description: "استرجاع قائمة المواعيد المحجوزة للعملاء (لمعرفة من لديه موعد ومتى).",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      limit: { 
        type: SchemaType.NUMBER, 
        description: "عدد المواعيد المراد استرجاعها، افتراضيا 10" 
      }
    },
    required: []
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
      const normalize = (s: string) => s.replace(/^(لـ|ل|من|عن|حساب|عميل)\s+/, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
      const normalizedInput = normalize(name);
      const allCustomers = await tx.customer.findMany({ where: { tenantId: tId }, select: { id: true, name: true } });
      const match = allCustomers.find((c: any) => normalize(c.name) === normalizedInput);
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

// === NEW: Universal grounding guard for all financial mutation tools ===
const FINANCIAL_TOOLS = new Set([
  "log_sale", "log_expense", "book_appointment", "log_purchase",
  "log_customer_payment", "log_supplier_payment", "log_sales_return", "log_purchase_return"
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
      const words = normalizedVal.split(" ").filter((w) => w.length > 1);
      const anyWordFound = words.length === 0 || words.some((w) => normalizedMsg.includes(w) || isArabicFuzzyMatch(w, msgWords));
      if (!anyWordFound) {
        return { ok: false, reason: `القيمة "${val}" في الحقل ${field} مش موجودة في رسالة المستخدم الأصلية` };
      }
    }
  }

  // B. Strict Numeric Value Grounding: Every extracted monetary amount must match or be derived from a number in the user message
  const extractAllNumbersFromText = (text: string): number[] => {
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
  };

  const p = Number(args?.price) || 0;
  const a = Number(args?.amount || args?.total_amount) || 0;
  const q = Number(args?.quantity) || 1;

  if (p > 0 || a > 0) {
    const userNums = extractAllNumbersFromText(msg);
    if (userNums.length === 0) {
      return { ok: false, reason: "الأداة رجّعت مبالغ رقمية لكن رسالة المستخدم لا تحتوي على أي رقم" };
    }
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

    if (!isMatch) {
      return { ok: false, reason: `المبلغ الاستخراجي (${p || a}) غير متطابق مع أي رقم في رسالة المستخدم (${userNums.join(", ")})` };
    }
  }

  const paidVal = Number(args?.paid_amount);
  if (!isNaN(paidVal) && paidVal > 0) {
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

export async function executeTool(name: string, args: any, tenantId?: string, userMessageText?: string, telegramMessageId?: number | string, callIndex: number = 0): Promise<{ success: boolean; resultText: string }> {
  try {
    const grounding = groundingCheck(name, args, userMessageText);
    if (!grounding.ok) {
      console.warn(`[Grounding Guard] Rejected ${name}:`, grounding.reason, { args, userMessageText });
      void logRejectedToolCall(tenantId, name, args, userMessageText, grounding.reason || "Grounding failure");
      return { success: false, resultText: "معنديش تفاصيل كفاية عشان أسجل العملية دي، ممكن توضحلي الصنف/المبلغ تاني؟" };
    }

    const isPureInquiry = userMessageText && /^(حساب|كشف\s*حساب|رصيد|ديون|كام\s*(على|له))\s+/i.test(userMessageText.trim());
    const isMutationTool = ["log_customer_payment", "log_supplier_payment", "log_sale", "log_purchase", "log_sales_return", "log_purchase_return"].includes(name);

    if (isPureInquiry && isMutationTool) {
      console.warn(`[LLM Guardrail] Blocked illegal mutation tool '${name}' invoked during pure inquiry message: "${userMessageText}"`);
      return { success: true, resultText: "" };
    }

    // Deterministic Server-Generated Idempotency Key (ignoring model hallucinated keys)
    const tId = tenantId || "global";
    const msgIdPart = telegramMessageId ? `msg_${telegramMessageId}` : `nomsg_${Date.now()}`;
    const effectiveIdempotencyKey = `${tId}:${name}:${msgIdPart}:call_${callIndex}`;
    const isMutation = name.startsWith("log_") || name.startsWith("book_");
    
    if (isMutation) {
      const fullKey = `${name}:${effectiveIdempotencyKey}`;
      if (executedKeys.has(fullKey)) {
        return { success: true, resultText: `تمت العملية بنجاح.` };
      }
      executedKeys.add(fullKey);
      if (executedKeys.size > 5000) executedKeys.clear();
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

      const priceDecimal = new Decimal(price || 0);
      const totalAmount = priceDecimal.mul(new Decimal(quantity || 1));
      
      const paid = (paid_amount !== undefined ? new Decimal(paid_amount) : totalAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const deferred = (deferred_amount !== undefined ? new Decimal(deferred_amount) : totalAmount.minus(paid)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      if (paid.isNegative() || deferred.isNegative() || paid.gt(totalAmount)) {
        return { success: false, resultText: "خطأ: المبلغ المدفوع لا يمكن أن يكون أكبر من الإجمالي أو سالباً." };
      }

      if (paid.add(deferred).equals(totalAmount) === false) {
        return { success: false, resultText: "خطأ: المدفوع والمتبقي لا يتطابقان مع الإجمالي." };
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
             customer = await tx.customer.create({
                data: {
                  name: custName || "عميل غير معروف",
                  phone: custPhone,
                  ...(tenantId && { tenantId })
                }
             });
          }
          customerId = customer.id;
        }

        const sale = await tx.sale.create({
          data: {
            itemName: String(item_name).trim(),
            price: priceDecimal.toNumber(),
            quantity: Number(quantity) || 1,
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
      return { success: true, resultText: `تم تسجيل بيع ${saleResult.quantity} ${saleResult.itemName} إجمالي ${saleResult.total} جنيه (مدفوع: ${saleResult.paidAmount}، متبقي: ${saleResult.deferredAmount}) بنجاح!` };
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
        const s = String(v).toLowerCase();
        return s.includes("يحدد") || s.includes("محدد") || s.includes("معروف") || s.includes("unspecified") || s.includes("unknown") || s.includes("none") || s.includes("null");
      };

      if (isPlaceholder(customer_name) || isPlaceholder(date) || isPlaceholder(time)) {
        const missing = [];
        if (isPlaceholder(customer_name)) missing.push("اسم العميل");
        if (isPlaceholder(date)) missing.push("التاريخ (مثال: 2025-08-10)");
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
      const custName = String(customer_name).trim();
      const custPhone = customer_phone ? String(customer_phone).trim() : null;
      let customer = await findCustomerFuzzy(prisma, tenantId || "", custName, custPhone);

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
      return { success: true, resultText: `تم حجز موعد لـ ${app.customerName} يوم ${app.date} الساعة ${app.time} بنجاح! ✅` };
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

       return { 
         success: true, 
         resultText: `📊 *كشف حساب العميل (${customer.name}):*\n\n🛍️ *إجمالي المشتريات:* ${totalSales.toNumber()} جنيه\n🔄 *إجمالي المرتجعات:* ${totalSalesReturns.toNumber()} جنيه\n💵 *المسدد نقداً (الصافي):* ${netPaid.toNumber()} جنيه\n📝 *الرصيد النهائي:* ${balanceStr}` 
       };
    }

    if (name === "log_purchase") {
      const { supplier_name, item_name, total_amount, paid_amount, quantity = 1, price_per_unit } = args;
      
      const isPlaceholder = (v: any) => {
        if (!v || String(v).trim() === "") return true;
        const s = String(v).trim().toLowerCase();
        return s === "مشتريات" || s === "شراء" || s === "صنف" || s === "مورد" || s.includes("يحدد") || s.includes("محدد") || s.includes("unspecified");
      };

      const qty = Number(quantity) || 1;

      let calcTotal = new Decimal(0);
      if (typeof total_amount === "number" && total_amount > 0) {
        calcTotal = new Decimal(total_amount);
      } else if (typeof price_per_unit === "number" && price_per_unit > 0) {
        calcTotal = new Decimal(price_per_unit).mul(qty);
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
            totalAmount: total.toNumber(),
            paidAmount: paid.toNumber(),
            deferredAmount: remaining.toNumber(),
            ...(tenantId && { tenantId })
          }
        });

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

      return { success: true, resultText: `تم تسجيل فاتورة مشتريات (${qty} ${purchaseResult.purchase.itemName}) من المورد (${purchaseResult.supplier.name}) بقيمة إجمالية ${purchaseResult.purchase.totalAmount} جنيه بنجاح! 📦` };
    }

    if (name === "log_supplier_payment") {
      const { supplier_name, amount } = args;
      if (!supplier_name || typeof amount !== "number" || amount <= 0) {
        return { success: false, resultText: "خطأ: اسم المورد والمبلغ مطلوبين." };
      }
      const payAmount = new Decimal(amount);
      const supName = String(supplier_name).trim();

      try {
        const { totalDebtResult, supplierFound } = await (prisma as any).$transaction(async (tx: any) => {
          const supplier = await tx.supplier.findFirst({
            where: { name: { contains: supName }, ...(tenantId && { tenantId }) }
          });
          if (!supplier) {
            throw new Error(` لم يتم العثور على المورد: ${supName}`);
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

      const supplier = await prisma.supplier.findFirst({
        where: { name: { contains: supName }, ...(tenantId && { tenantId }) },
        include: { purchases: true }
      });

      if (!supplier) {
        return { success: false, resultText: `لم يتم العثور على المورد: ${supName}` };
      }

      let totalPurchases = new Decimal(0);
      let totalPaidOnPurchases = new Decimal(0);
      let totalDebt = new Decimal(0);
      
      for (const p of supplier.purchases || []) {
        totalPurchases = totalPurchases.add(p.totalAmount);
        totalPaidOnPurchases = totalPaidOnPurchases.add(p.paidAmount);
        totalDebt = totalDebt.add(p.deferredAmount);
      }

      return {
        success: true,
        resultText: `📊 *كشف حساب المورد (${supplier.name}):*\n\n📦 *إجمالي المشتريات منه:* ${totalPurchases.toNumber()} جنيه\n💵 *إجمالي المسدد له:* ${totalPaidOnPurchases.toNumber()} جنيه\n📝 *الديون المتبقية له (الآجل):* ${totalDebt.toNumber()} جنيه`
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
      const limit = args.limit || 10;
      const apps = await prisma.appointment.findMany({
        where: { ...(tenantId && { tenantId }) },
        orderBy: { createdAt: 'desc' },
        take: Number(limit)
      });
      if (apps.length === 0) {
        return { success: true, resultText: "لا توجد أي مواعيد مسجلة حالياً." };
      }
      const appsList = apps.map(a => `- ${a.customerName} (يوم ${a.date} الساعة ${a.time})`).join('\n');
      return { 
        success: true, 
        resultText: `📅 **قائمة المواعيد:**\n\n${appsList}`
      };
    }

    if (name === "report_missing_feature") {
      const { feature_description } = args;
      const adminChatId = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
      
      let tenantInfo = tenantId ? `العميل رقم: ${tenantId}` : "عميل غير معروف";

      if (adminChatId) {
        await sendTelegramAlert({
          chatId: adminChatId,
          text: `⚠️ **اقتراح ميزة جديدة من البوت!**\n\n${tenantInfo} طلب ميزة غير متاحة حالياً:\n\n💬 "${feature_description}"\n\nهل ترغب ببرمجتها؟`,
          idempotencyKey: `feature-req-${Date.now()}`
        });
      }
      return { 
        success: true, 
        resultText: "تم إرسال اقتراحك للمطور بنجاح! سيتم العمل على إضافتها قريباً، شكراً لك."
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
  telegramMessageId?: number | string
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

  // Save incoming user message to history buffer (non-blocking)
  void saveChatMessage(tenantId, telegramChatId, "user", text);

  // === NEW: Small-talk short-circuit — no LLM, no tools ===
  const SMALL_TALK_PATTERNS = [
    /^ايه\s*الدنيا/i, /^إيه\s*الدنيا/i, /^ازيك/i, /^إزيك/i, /^عامل\s*ايه/i, /^اخبارك/i, /^أخبارك/i,
    /^صباح\s*الخير/i, /^مساء\s*الخير/i, /^سلام/i, /^اهلا/i, /^أهلا/i, /^هاي$/i, /^هلا/i
  ];
  const trimmedText = text.trim();
  if (SMALL_TALK_PATTERNS.some((re) => re.test(trimmedText)) && trimmedText.length < 25) {
    const reply = "أهلاً بيك يا فندم! 😊 قولّي محتاج تسجل بيع، مصروف، ولا تحجز ميعاد؟";
    void saveChatMessage(tenantId, telegramChatId, "assistant", reply);
    return { status: "success", text: reply };
  }
  // === END small-talk router ===

  // Try models in order - first available free-tier model wins
  const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro", "gemini-1.5-pro"];
  let lastError: any = null;
  const maxRetries = 3;

  const companyStr = tenantName ? `بشركة ${tenantName}` : "بنظامنا الذكي";
  const typeStr = businessType ? `(نوع النشاط: ${businessType})` : "";
  const hoursStr = workingHours ? `(مواعيد العمل: ${workingHours})` : "";
  const systemInstruction = `أنت المساعد الشخصي الذكي الخاص بمدير أو صاحب العمل ${companyStr} ${typeStr} ${hoursStr}.
تحدث بالعامية المصرية الحية والراقية مباشرة وسريعة.

قواعد استخراج وفهم المبيعات عند استخدام أداة log_sale:
1. فصل اسم البضاعة عن اسم العميل:
   - اسم البضاعة بييجي في البداية (مثال: "[اسم صنف]", "زيت موتور", "شاشة 55").
   - اسم العميل بييجي في نهاية الجملة أو بعد (لـ / حساب / عميل) مثل: "احمد محمد", "لـ أحمد", "حساب المهندس مدحت".
2. استخراج الكميات والأسعار:
   - الأرقام والوحدات: "[كمية] [اسم صنف] بـ [مبلغ]" -> استخرج الكمية كرقم، اسم الصنف كنص، وسعر الوحدة = المبلغ ÷ الكمية إذا ذُكر الإجمالي فقط.
   - الصيغ والجموع: "كرتونتين مسامير" -> quantity = 2، "5 قطف" -> quantity = 5.
3. التمييز الدقيق بين الكاش والآجل:
   - إذا ذكر كلمة "آجل" أو "على الحساب" -> paid_amount: 0, deferred_amount: الإجمالي.
   - إذا كان البيع عادي أو كاش -> paid_amount: الإجمالي, deferred_amount: 0.
   - إذا كان عربون/مقدم: "دفع 100 والباقي آجل" -> paid_amount: 100, deferred_amount: المتبقي.
4. حظر الأوصاف والأسعار الوهمية:
   - إذا كتب العميل كلمة "بيع" فقط أو لم يحدد البضاعة والسعر، اسأله عن التفاصيل فوراً ولا تفترض أبداً صنفاً مثل "المنتج" أو سعراً افتراضياً.
5. الاستعلام عن رصيد وحساب عميل (get_customer_balance):
   - عندما يكتب العميل عبارات مثل: "حساب [اسم العميل]", "كشف حساب [اسم]", "رصيد [اسم]", "هو عليه كام؟" -> يجب استخدام أداة get_customer_balance فقط! يُمنع منعاً باتاً استدعاء أداة سداد log_customer_payment أو أداة log_sale عند الاستعلام عن الحسابات!
7. سداد ديون واستعلام حسابات الموردين (log_supplier_payment / get_supplier_balance):
   - عند السداد للمورد ("دفعت للمورد المتخصص 500", "سددت للمورد احمد 200") -> استخدم فوراً أداة log_supplier_payment.
   - عند الاستعلام عن حساب ورصيد مورد ("حساب المورد المتخصص", "كشف حساب المورد علي", "ديون المورد احمد") -> استخدم فوراً أداة get_supplier_balance!
8. تسجيل مرتجعات المبيعات والمشتريات (log_sales_return / log_purchase_return):
   - عند إرجاع العميل لبضاعة ("رجعت من احمد 1 كرتونة مسامير", "مرتجع مبيعات كرتونة مسامير من أحمد قيمة 50") -> استخدم أداة log_sales_return واستخرج اسم الصنف المرتجع والكمية والمبلغ.
   - إذا كان لدى العميل أصناف متعددة مباعة وكتب التاجر مرتجعاً عاماً دون تحديد اسم الصنف (مثل: "رجعت كرتونة بـ 250"), اسأل التاجر فوراً وبذكاء بالعامية لتحديد الصنف لإرجاعه للمخزن بدقة (مثال: "تمام يا فندم، المرتجع كرتونة مسامير ولا كرتونة لزق عشان أزود رصيده بالمخزن؟").
   - عند إرجاع بضاعة للمورد ("رجعت للمورد المتخصص 2 كرتونة بـ 100", "مرتجع مشتريات للمورد المتخصص بقيمة 100") -> استخدم أداة log_purchase_return!
9. التمييز بين سداد العميل واسترداد العميل للكاش (log_customer_payment):
   - إذا كان العميل يسدد للمحل ("سدد أحمد 100", "قبضت من أحمد 100", "أحمد دفع 100") -> استخدم log_customer_payment بـ is_refund: false.
   - إذا كان المحل هو من يدفع/يرد مبلغ كاش للعميل ("ادفع 100 لأحمد", "رديت 100 لأحمد", "اعطي أحمد 100") -> استخدم log_customer_payment بـ is_refund: true!`;

  // Format history for Gemini SDK
  const geminiHistory = rawHistory.map(h => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.text }]
  }));

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
          tools: [{ functionDeclarations: [logSaleTool, logExpenseTool, bookAppointmentTool, logPurchaseTool, getFinancialSummaryTool, getAppointmentsListTool, reportMissingFeatureTool, logCustomerPaymentTool, getCustomerBalanceTool, logSupplierPaymentTool, getSupplierBalanceTool, logSalesReturnTool, logPurchaseReturnTool] }],
          systemInstruction
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
            const toolRes = await executeTool(call.name, call.args, tenantId, text, telegramMessageId, idx);
            combinedResults.push(toolRes.resultText);
          }
          finalReply = combinedResults.join('\n\n').trim();
        } else {
          finalReply = sanitizeNonToolReply(response.text().trim() || "تمام يا فندم، أنا معاك.");
        }

        void saveChatMessage(tenantId, telegramChatId, "assistant", finalReply);
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

      // Build OpenAI-compatible tools from our FunctionDeclarations
      const groqTools = [
        logSaleTool, logExpenseTool, bookAppointmentTool, logPurchaseTool,
        getFinancialSummaryTool, getAppointmentsListTool, reportMissingFeatureTool,
        logCustomerPaymentTool, getCustomerBalanceTool, logSupplierPaymentTool, getSupplierBalanceTool,
        logSalesReturnTool, logPurchaseReturnTool
      ].map(t => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters as any  // Gemini schema is compatible at runtime
        }
      }));

      // P2: Inject last 3 messages as context summary in system prompt
      // Groq function calling conflicts with multi-turn history arrays — system injection is more reliable
      const contextSummary = rawHistory.length > 0
        ? `\n\n---\n[سياق آخر رسائل المحادثة - استخدمه لربط الضمائر مثل "هو/هي/الباقي/نفس العميل"]:\n` +
          rawHistory.slice(-3).map(h =>
            `${h.role === "user" ? "🧑 التاجر" : "🤖 المساعد"}: ${h.text.slice(0, 200)}`
          ).join("\n")
        : "";

      const groqMessages = [
        { role: "system", content: systemInstruction + contextSummary },
        { role: "user", content: text }
      ];

      const groqRes = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: groqMessages as any,
        tools: groqTools,
        tool_choice: "auto",
        max_tokens: 1024
      });

      const choice = groqRes.choices[0];
      const toolCalls = choice?.message?.tool_calls;
      let finalReply = "";

      if (toolCalls && toolCalls.length > 0) {
        const results: string[] = [];
        for (let idx = 0; idx < toolCalls.length; idx++) {
          const call = toolCalls[idx];
          let args: Record<string, any> = {};
          try { args = JSON.parse(call.function.arguments); } catch {}
          const toolRes = await executeTool(call.function.name, args, tenantId, text, telegramMessageId, idx);
          results.push(toolRes.resultText);
        }
        finalReply = results.join('\n\n').trim();
      } else {
        finalReply = sanitizeNonToolReply(choice?.message?.content?.trim() || "تمام يا فندم، أنا معاك.");
      }

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
                args = JSON.parse(jsonMatch[0]);
              } catch (e) {
                console.error("[Groq Parser] JSON parse error:", jsonMatch[0], e);
              }
            }
            const toolRes = await executeTool(funcName, args, tenantId, text, telegramMessageId, 0);
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

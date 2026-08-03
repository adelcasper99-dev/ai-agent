import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import Groq from "groq-sdk";
import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";
import { sendTelegramAlert } from "./telegram";

const prisma = new PrismaClient();

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

async function executeTool(name: string, args: any, tenantId?: string, userMessageText?: string): Promise<{ success: boolean; resultText: string }> {
  try {
    const isPureInquiry = userMessageText && /^(حساب|كشف\s*حساب|رصيد|ديون|كام\s*(على|له))\s+/i.test(userMessageText.trim());
    const isMutationTool = ["log_customer_payment", "log_supplier_payment", "log_sale", "log_purchase", "log_sales_return", "log_purchase_return"].includes(name);

    if (isPureInquiry && isMutationTool) {
      console.warn(`[LLM Guardrail] Blocked illegal mutation tool '${name}' invoked during pure inquiry message: "${userMessageText}"`);
      return { success: true, resultText: "" };
    }

    const { idempotency_key } = args;
    const isMutation = name.startsWith("log_") || name.startsWith("book_");
    
    if (isMutation && idempotency_key && String(idempotency_key).length > 5) {
      const fullKey = `${name}:${idempotency_key}`;
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

      if (isPlaceholderItem(item_name) || typeof price !== "number" || price <= 0) {
        return { success: false, resultText: "عشان أسجلك عملية البيع محتاج تقولي: اسم الصنف المباع، السعر الإجمالي، اسم العميل (اختياري) 💰" };
      }
      const totalAmount = new Decimal(price).mul(quantity);
      const paid = paid_amount !== undefined ? new Decimal(paid_amount) : totalAmount;
      const deferred = deferred_amount !== undefined ? new Decimal(deferred_amount) : totalAmount.minus(paid);
      
      const saleResult = await prisma.$transaction(async (tx) => {
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
            price: price,
            quantity: Number(quantity) || 1,
            total: totalAmount.toNumber(),
            paidAmount: paid.toNumber(),
            deferredAmount: deferred.toNumber(),
            customerName: custName,
            ...(customerId && { customerId }),
            ...(tenantId && { tenantId })
          }
        });

        if (customerId) {
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
           if (paid.gt(0)) {
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
        if (deferred.gt(0)) {
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
        if (paid.gt(0)) {
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
        await tx.journalEntry.create({
             data: {
               accountCode: "SALES_REVENUE",
               credit: totalAmount.toNumber(),
               referenceId: sale.id,
               description: `إيرادات مبيعات: ${sale.itemName}`,
               ...(tenantId && { tenantId })
             }
        });
        return sale;
      });
      return { success: true, resultText: `تم تسجيل بيع ${saleResult.quantity} ${saleResult.itemName} إجمالي ${saleResult.total} جنيه (مدفوع: ${saleResult.paidAmount}، متبقي: ${saleResult.deferredAmount}) بنجاح!` };
    }

    if (name === "log_expense") {
      const { amount, description, category = "عام" } = args;
      const isPlaceholderDesc = (v: any) => {
        if (!v || String(v).trim() === "") return true;
        const s = String(v).trim().toLowerCase();
        return s === "مصروف" || s === "مصاريف" || s.includes("يحدد") || s.includes("محدد");
      };
      if (typeof amount !== "number" || amount <= 0 || isPlaceholderDesc(description)) {
        return { success: false, resultText: "عشان أسجلك المصروف محتاج تقولي: المبلغ وبيان المصروف (مثال: كهرباء 500ج أو إيجار 2000ج) 💸" };
      }
      const expense = await prisma.expense.create({
        data: {
          amount: amount,
          description: String(description).trim(),
          category: String(category).trim(),
          ...(tenantId && { tenantId })
        }
      });
      return { success: true, resultText: `تم تسجيل مصروف ${expense.amount} جنيه (${expense.description}) بنجاح!` };
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
         const paymentResult = await prisma.$transaction(async (tx) => {
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
          } else if (l.entryType === "PAYMENT_CREDIT") {
            if (l.description?.startsWith("مرتجع مبيعات")) {
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

      let calcTotal = 0;
      if (typeof total_amount === "number" && total_amount > 0) {
        calcTotal = total_amount;
      } else if (typeof price_per_unit === "number" && price_per_unit > 0) {
        calcTotal = price_per_unit * qty;
      }

      if (isPlaceholder(supplier_name) || isPlaceholder(item_name) || calcTotal <= 0) {
        return { success: false, resultText: "عشان أسجلك فاتورة المشتريات محتاج تقولي: اسم المورد، الصنف المشترى، والسعر 📦" };
      }

      if (!tenantId) {
        return { success: false, resultText: "عذراً، لم أتمكن من تسجيل المشتريات لوجود مشكلة في التعرف على حساب الشركة (tenantId مفقود)." };
      }

      const total = new Decimal(calcTotal);
      const paid = new Decimal(paid_amount ?? calcTotal);
      const remaining = total.sub(paid);
      const supplierNameStr = String(supplier_name).trim();

      const supplier = await prisma.supplier.upsert({
        where: { tenantId_name: { tenantId, name: supplierNameStr } },
        update: {},
        create: { name: supplierNameStr, tenantId }
      });

      const purchase = await prisma.purchase.create({
        data: {
          supplierId: supplier.id,
          itemName: String(item_name).trim(),
          totalAmount: total.toNumber(),
          paidAmount: paid.toNumber(),
          deferredAmount: remaining.toNumber(),
          ...(tenantId && { tenantId })
        }
      });

      return { success: true, resultText: `تم تسجيل فاتورة مشتريات (${qty} ${purchase.itemName}) من المورد (${supplier.name}) بقيمة إجمالية ${purchase.totalAmount} جنيه بنجاح! 📦` };
    }

    if (name === "log_supplier_payment") {
      const { supplier_name, amount } = args;
      if (!supplier_name || typeof amount !== "number" || amount <= 0) {
        return { success: false, resultText: "خطأ: اسم المورد والمبلغ مطلوبين." };
      }
      const payAmount = new Decimal(amount);
      const supName = String(supplier_name).trim();

      const supplier = await prisma.supplier.findFirst({
        where: { name: { contains: supName }, ...(tenantId && { tenantId }) }
      });
      if (!supplier) {
        return { success: false, resultText: `لم يتم العثور على المورد: ${supName}` };
      }

      // 1. Record SupplierPayment
      await (prisma as any).supplierPayment.create({
        data: {
          supplierId: supplier.id,
          amount: payAmount.toNumber(),
          notes: `سداد دفعة نقدية للمورد`,
          ...(tenantId && { tenantId })
        }
      });

      // 2. Deduct from deferredAmount on open purchases
      const openPurchases = await prisma.purchase.findMany({
        where: { supplierId: supplier.id, deferredAmount: { gt: 0 } },
        orderBy: { createdAt: "asc" }
      });

      let remainingToDeduct = payAmount;
      for (const p of openPurchases) {
        if (remainingToDeduct.lte(0)) break;
        const curDef = new Decimal(p.deferredAmount);
        const curPaid = new Decimal(p.paidAmount);
        if (remainingToDeduct.gte(curDef)) {
          await prisma.purchase.update({
            where: { id: p.id },
            data: {
              paidAmount: curPaid.add(curDef).toNumber(),
              deferredAmount: 0
            }
          });
          remainingToDeduct = remainingToDeduct.sub(curDef);
        } else {
          await prisma.purchase.update({
            where: { id: p.id },
            data: {
              paidAmount: curPaid.add(remainingToDeduct).toNumber(),
              deferredAmount: curDef.sub(remainingToDeduct).toNumber()
            }
          });
          remainingToDeduct = new Decimal(0);
        }
      }

      // 3. Calculate remaining total debt for supplier
      const allPurchases = await prisma.purchase.findMany({ where: { supplierId: supplier.id } });
      const totalDebt = allPurchases.reduce((sum, p) => sum + p.deferredAmount, 0);

      return {
        success: true,
        resultText: `تم تسجيل سداد مبلغ ${amount} جنيه للمورد (${supplier.name}) بنجاح! 💸\nالمتبقي له (الديون): ${totalDebt} جنيه.`
      };
    }

    if (name === "get_supplier_balance") {
      const { supplier_name } = args;
      const supName = String(supplier_name).trim();

      const supplier = await (prisma as any).supplier.findFirst({
        where: { name: { contains: supName }, ...(tenantId && { tenantId }) },
        include: { purchases: true, supplierPayments: true }
      });

      if (!supplier) {
        return { success: false, resultText: `لم يتم العثور على المورد: ${supName}` };
      }

      const totalPurchases = (supplier.purchases || []).reduce((acc: number, p: any) => acc + p.totalAmount, 0);
      const totalPaidOnPurchases = (supplier.purchases || []).reduce((acc: number, p: any) => acc + p.paidAmount, 0);
      const totalDebt = (supplier.purchases || []).reduce((acc: number, p: any) => acc + p.deferredAmount, 0);

      return {
        success: true,
        resultText: `📊 *كشف حساب المورد (${supplier.name}):*\n\n📦 *إجمالي المشتريات منه:* ${totalPurchases} جنيه\n💵 *إجمالي المسدد له:* ${totalPaidOnPurchases} جنيه\n📝 *الديون المتبقية له (الآجل):* ${totalDebt} جنيه`
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

      let customer = await findCustomerFuzzy(prisma, tenantId || "", custName, null);
      if (!customer) {
        return { success: false, resultText: `لم يتم العثور على العميل: ${custName}` };
      }

      await prisma.customerLedgerEntry.create({
        data: {
          customerId: customer.id,
          entryType: "PAYMENT_CREDIT",
          amount: retAmount.toNumber(),
          description: `مرتجع مبيعات: ${qty} ${itemNameStr}`,
          ...(tenantId && { tenantId })
        }
      });

      return {
        success: true,
        resultText: `تم تسجيل مرتجع مبيعات (${qty} ${itemNameStr}) من العميل (${customer.name}) بقيمة ${retAmount.toNumber()} جنيه وتحديث حسابه بنجاح! 🔄`
      };
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

      const supplier = await prisma.supplier.findFirst({
        where: { name: { contains: supName }, ...(tenantId && { tenantId }) }
      });
      if (!supplier) {
        return { success: false, resultText: `لم يتم العثور على المورد: ${supName}` };
      }

      // Deduct from deferredAmount on open purchases
      const openPurchases = await prisma.purchase.findMany({
        where: { supplierId: supplier.id, deferredAmount: { gt: 0 } },
        orderBy: { createdAt: "desc" }
      });

      let remainingToDeduct = retAmount;
      for (const p of openPurchases) {
        if (remainingToDeduct.lte(0)) break;
        const curDef = new Decimal(p.deferredAmount);
        if (remainingToDeduct.gte(curDef)) {
          await prisma.purchase.update({
            where: { id: p.id },
            data: { deferredAmount: 0 }
          });
          remainingToDeduct = remainingToDeduct.sub(curDef);
        } else {
          await prisma.purchase.update({
            where: { id: p.id },
            data: { deferredAmount: curDef.sub(remainingToDeduct).toNumber() }
          });
          remainingToDeduct = new Decimal(0);
        }
      }

      return {
        success: true,
        resultText: `تم تسجيل مرتجع مشتريات (${qty} ${itemNameStr}) للمورد (${supplier.name}) بقيمة ${retAmount.toNumber()} جنيه بنجاح! 🔄`
      };
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
      const totalSales = sales.reduce((acc, s) => acc + s.total, 0);

      const expenses = await prisma.expense.findMany({
        where: {
          createdAt: { gte: startDate, lt: endDate },
          ...(tenantId && { tenantId })
        }
      });
      const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

      return { 
        success: true, 
        resultText: `📊 **ملخص ${periodName}:**\n\n🟢 المبيعات: ${totalSales} جنيه\n🔴 المصروفات: ${totalExpenses} جنيه\n\nالصافي: ${totalSales - totalExpenses} جنيه`
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
  telegramChatId?: string
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
   - اسم البضاعة بييجي في البداية (مثال: "2 كرتونة مسامير", "زيت موتور", "شاشة 55").
   - اسم العميل بييجي في نهاية الجملة أو بعد (لـ / حساب / عميل) مثل: "احمد محمد", "لـ أحمد", "حساب المهندس مدحت".
2. استخراج الكميات والأسعار:
   - الأرقام والوحدات: "2 كرتونة مسامير بـ 250" -> الكمية quantity = 2, اسم المنتج item_name = "كرتونة مسامير", سعر الوحدة price = 125 (أو قسمة 250 على 2).
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
          for (const call of functionCalls) {
            const toolRes = await executeTool(call.name, call.args, tenantId, text);
            combinedResults.push(toolRes.resultText);
          }
          finalReply = combinedResults.join('\n\n').trim();
        } else {
          finalReply = response.text().trim() || "تمام يا فندم، أنا معاك.";
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
        for (const call of toolCalls) {
          let args: Record<string, any> = {};
          try { args = JSON.parse(call.function.arguments); } catch {}
          const toolRes = await executeTool(call.function.name, args, tenantId, text);
          results.push(toolRes.resultText);
        }
        finalReply = results.join('\n\n').trim();
      } else {
        finalReply = choice?.message?.content?.trim() || "تمام يا فندم، أنا معاك.";
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
            const toolRes = await executeTool(funcName, args, tenantId, text);
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

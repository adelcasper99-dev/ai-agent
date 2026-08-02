import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import Groq from "groq-sdk";
import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";
import { sendTelegramAlert } from "./telegram";

const prisma = new PrismaClient();

const logSaleTool: FunctionDeclaration = {
  name: "log_sale",
  description: "تسجيل عملية بيع لعميل (منتج، سعر، كمية، اسم العميل، وتليفونه)",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      item_name: { type: SchemaType.STRING, description: "اسم المنتج المباع" },
      price: { type: SchemaType.NUMBER, description: "سعر الوحدة أو إجمالي السعر المتفق عليه بالجنيه" },
      quantity: { type: SchemaType.NUMBER, description: "الكمية المباعة (الافتراضي 1)" },
      customer_name: { type: SchemaType.STRING, description: "اسم العميل (اختياري)" },
      customer_phone: { type: SchemaType.STRING, description: "تليفون العميل (اختياري، يفضل استخدامه إن وجد)" },
      paid_amount: { type: SchemaType.NUMBER, description: "المبلغ المدفوع (عربون أو دفعة مقدمة)" },
      deferred_amount: { type: SchemaType.NUMBER, description: "المبلغ المتبقي الآجل" },
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
  description: "تسجيل فاتورة مشتريات جديدة من مورد معين.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      supplier_name: { type: SchemaType.STRING, description: "اسم المورد" },
      item_name: { type: SchemaType.STRING, description: "اسم أو تفاصيل الصنف المشترى" },
      total_amount: { type: SchemaType.NUMBER, description: "إجمالي قيمة الفاتورة" },
      paid_amount: { type: SchemaType.NUMBER, description: "المبلغ المدفوع (اختياري، إذا لم يذكر يعتبر الفاتورة مدفوعة بالكامل)" }
    },
    required: ["supplier_name", "item_name", "total_amount"]
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
  description: "تسجيل دفعة سداد ديون أو آجل من عميل (سداد من حسابه).",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      customer_name: { type: SchemaType.STRING, description: "اسم العميل" },
      customer_phone: { type: SchemaType.STRING, description: "تليفون العميل (إن وجد)" },
      amount: { type: SchemaType.NUMBER, description: "المبلغ المسدد بالجنيه" },
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
      const normalize = (s: string) => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
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

async function executeTool(name: string, args: any, tenantId?: string): Promise<{ success: boolean; resultText: string }> {
  try {
    const { idempotency_key } = args;
    if (idempotency_key) {
      if (executedKeys.has(idempotency_key)) {
        return { success: true, resultText: `تمت العملية بنجاح.` };
      }
      executedKeys.add(idempotency_key);
      if (executedKeys.size > 5000) executedKeys.clear();
    }

    if (name === "log_sale") {
      const { item_name, price, quantity = 1, customer_name = "", customer_phone = "", paid_amount, deferred_amount } = args;
      if (!item_name || typeof price !== "number" || price <= 0) {
        return { success: false, resultText: "خطأ: اسم المنتج وسعر الوحدة مطلوبين بشكل صحيح." };
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
      if (typeof amount !== "number" || amount <= 0 || !description) {
        return { success: false, resultText: "خطأ: المبلغ والسبب مطلوبين." };
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
      if (!customer_name || !date || !time) {
        return { success: false, resultText: "خطأ: اسم العميل والتاريخ والوقت مطلوبين." };
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
      return { success: true, resultText: `تم حجز موعد لـ ${app.customerName} يوم ${app.date} الساعة ${app.time} بنجاح!` };
    }

    if (name === "log_customer_payment") {
       const { customer_name, customer_phone, amount } = args;
       if (!customer_name || typeof amount !== "number" || amount <= 0) {
         return { success: false, resultText: "خطأ: اسم العميل والمبلغ مطلوبين." };
       }
       const payAmount = new Decimal(amount);
       const custName = String(customer_name).trim();
       const custPhone = customer_phone ? String(customer_phone).trim() : null;

       try {
         const paymentResult = await prisma.$transaction(async (tx) => {
            let customer = await findCustomerFuzzy(tx, tenantId || "", custName, custPhone);
            if (!customer) {
               throw new Error(`لم يتم العثور على العميل: ${custName}`);
            }
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
            return customer;
         });
         return { success: true, resultText: `تم تسجيل سداد مبلغ ${amount} جنيه من العميل ${paymentResult.name} بنجاح!` };
       } catch (err: any) {
         return { success: false, resultText: err.message || "حدث خطأ أثناء السداد." };
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
       
       let totalDebit = new Decimal(0);
       let totalCredit = new Decimal(0);
       customer.ledgers.forEach((l: any) => {
          if (l.entryType === "SALE_DEBIT") totalDebit = totalDebit.plus(l.amount);
          if (l.entryType === "PAYMENT_CREDIT") totalCredit = totalCredit.plus(l.amount);
       });
       const balance = totalDebit.minus(totalCredit);
       return { success: true, resultText: `العميل ${customer.name}: إجمالي المشتريات ${totalDebit.toNumber()}ج، المسدد منها ${totalCredit.toNumber()}ج. الرصيد المتبقي عليه: ${balance.toNumber()}ج.` };
    }

    if (name === "log_purchase") {
      const { supplier_name, item_name, total_amount, paid_amount } = args;
      if (!supplier_name || !item_name || typeof total_amount !== "number") {
        return { success: false, resultText: "خطأ: اسم المورد والصنف والمبلغ الإجمالي مطلوبين." };
      }
      if (!tenantId) {
        return { success: false, resultText: "عذراً، لم أتمكن من تسجيل المشتريات لوجود مشكلة في التعرف على حساب الشركة (tenantId مفقود)." };
      }
      const total = new Decimal(total_amount);
      const paid = new Decimal(paid_amount ?? total_amount);
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
      return { success: true, resultText: `تم تسجيل فاتورة مشتريات من ${supplier.name} بقيمة ${purchase.totalAmount} جنيه بنجاح!` };
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

export async function processTelegramMessageWithLLM(
  text: string,
  tenantId?: string,
  tenantName?: string,
  businessType?: string,
  workingHours?: string
): Promise<string> {
  const { getValidApiKey, markKeyExhausted } = await import('./apiKeyManager');
  
  // Try models in order - first available free-tier model wins
  const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro", "gemini-1.5-pro"];
  let lastError: any = null;
  const maxRetries = 3;

  const companyStr = tenantName ? `بشركة ${tenantName}` : "بنظامنا الذكي";
  const typeStr = businessType ? `(نوع النشاط: ${businessType})` : "";
  const hoursStr = workingHours ? `(مواعيد العمل: ${workingHours})` : "";
  const systemInstruction = `أنت المساعد الشخصي الذكي الخاص بمدير أو صاحب العمل ${companyStr} ${typeStr} ${hoursStr}.
تحدث بالعامية المصرية الحية والراقية مباشرة وسريعة.
إذا طلب العميل تسجيل بيع، مصروف، موعد، أو مشتريات، استخدم الأداة المناسبة فوراً.
إذا نفذت أداة بنجاح، أكد العملية للعميل بجملة ودية مختصرة.
إذا سألك العميل عن مواعيد العمل أو نوع النشاط، استخدم البيانات المتاحة أعلاه للرد بدقة.`;

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
          tools: [{ functionDeclarations: [logSaleTool, logExpenseTool, bookAppointmentTool, logPurchaseTool, getFinancialSummaryTool, getAppointmentsListTool, reportMissingFeatureTool, logCustomerPaymentTool, getCustomerBalanceTool] }],
          systemInstruction
        });

        const chat = model.startChat();
        const result = await chat.sendMessage(text);
        const response = result.response;
        const functionCalls = response.functionCalls();

        if (functionCalls && functionCalls.length > 0) {
          const combinedResults = [];
          for (const call of functionCalls) {
            const toolRes = await executeTool(call.name, call.args, tenantId);
            combinedResults.push(toolRes.resultText);
          }
          return combinedResults.join('\n\n');
        }

        return response.text().trim() || "تمام يا فندم، أنا معاك.";
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

  // ========== GROQ FALLBACK ==========
  // Triggered when all Gemini keys are exhausted or unavailable
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey) {
    console.log("[Telegram LLM] Gemini exhausted — falling back to Groq Llama");
    try {
      const groq = new Groq({ apiKey: groqApiKey });

      // Build OpenAI-compatible tools from our FunctionDeclarations
      const groqTools = [
        logSaleTool, logExpenseTool, bookAppointmentTool, logPurchaseTool,
        getFinancialSummaryTool, getAppointmentsListTool, reportMissingFeatureTool,
        logCustomerPaymentTool, getCustomerBalanceTool
      ].map(t => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters as any  // Gemini schema is compatible at runtime
        }
      }));

      const groqRes = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: text }
        ],
        tools: groqTools,
        tool_choice: "auto",
        max_tokens: 1024
      });

      const choice = groqRes.choices[0];
      const toolCalls = choice?.message?.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        const results: string[] = [];
        for (const call of toolCalls) {
          let args: Record<string, any> = {};
          try { args = JSON.parse(call.function.arguments); } catch {}
          const toolRes = await executeTool(call.function.name, args, tenantId);
          results.push(toolRes.resultText);
        }
        return results.join('\n\n');
      }

      return choice?.message?.content?.trim() || "تمام يا فندم، أنا معاك.";
    } catch (groqErr: any) {
      console.error("[Telegram LLM Groq Fallback Error]:", groqErr);
      return `⚠️ كل المفاتيح المتاحة مستنفدة حالياً، يرجى المحاولة بعد قليل أو إضافة مفاتيح جديدة من لوحة التحكم.`;
    }
  }

  return `⚠️ كل مفاتيح Gemini مستنفدة ولا يوجد مفتاح Groq احتياطي. يرجى إضافة مفاتيح جديدة من لوحة التحكم.`;
}

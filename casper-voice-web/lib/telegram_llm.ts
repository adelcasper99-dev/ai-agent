import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

const logSaleTool: FunctionDeclaration = {
  name: "log_sale",
  description: "تسجيل عملية بيع لعميل (منتج، سعر، كمية، اسم العميل)",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      item_name: { type: SchemaType.STRING, description: "اسم المنتج المباع" },
      price: { type: SchemaType.NUMBER, description: "سعر الوحدة بالجنيه" },
      quantity: { type: SchemaType.NUMBER, description: "الكمية المباعة (الافتراضي 1)" },
      customer_name: { type: SchemaType.STRING, description: "اسم العميل (اختياري)" }
    },
    required: ["item_name", "price"]
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
      date: { type: SchemaType.STRING, description: "تاريخ الموعد (مثال: 2026-08-01 أو الغد)" },
      time: { type: SchemaType.STRING, description: "وقت الموعد (مثال: 05:00 مساءً)" },
      notes: { type: SchemaType.STRING, description: "ملاحظات إضافية (اختياري)" }
    },
    required: ["customer_name", "date", "time"]
  }
};

const logPurchaseTool: FunctionDeclaration = {
  name: "log_purchase",
  description: "تسجيل فاتورة مشتريات من مورد (اسم المورد، الصنف، المبلغ الإجمالي، المدفوع)",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      supplier_name: { type: SchemaType.STRING, description: "اسم المورد" },
      item_name: { type: SchemaType.STRING, description: "اسم الصنف أو البضاعة" },
      total_amount: { type: SchemaType.NUMBER, description: "المبلغ الإجمالي بالجنيه" },
      paid_amount: { type: SchemaType.NUMBER, description: "المبلغ المدفوع كاش" }
    },
    required: ["supplier_name", "item_name", "total_amount"]
  }
};

async function executeTool(name: string, args: any, tenantId?: string): Promise<{ success: boolean; resultText: string }> {
  try {
    if (name === "log_sale") {
      const { item_name, price, quantity = 1, customer_name = "" } = args;
      if (!item_name || typeof price !== "number" || price <= 0) {
        return { success: false, resultText: "خطأ: اسم المنتج وسعر الوحدة مطلوبين بشكل صحيح." };
      }
      const totalAmount = new Decimal(price).mul(quantity);
      const sale = await prisma.sale.create({
        data: {
          itemName: String(item_name).trim(),
          price: price,
          quantity: Number(quantity) || 1,
          total: totalAmount.toNumber(),
          customerName: customer_name ? String(customer_name).trim() : "",
          ...(tenantId && { tenantId })
        }
      });
      return { success: true, resultText: `تم تسجيل بيع ${sale.quantity} ${sale.itemName} إجمالي ${sale.total} جنيه بنجاح!` };
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
      const { customer_name, date, time, notes = "" } = args;
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
      const app = await prisma.appointment.create({
        data: {
          customerName: String(customer_name).trim(),
          date: String(date).trim(),
          time: String(time).trim(),
          notes: String(notes).trim(),
          ...(tenantId && { tenantId })
        }
      });
      return { success: true, resultText: `تم حجز موعد لـ ${app.customerName} يوم ${app.date} الساعة ${app.time} بنجاح!` };
    }

    if (name === "log_purchase") {
      const { supplier_name, item_name, total_amount, paid_amount } = args;
      if (!supplier_name || !item_name || typeof total_amount !== "number") {
        return { success: false, resultText: "خطأ: اسم المورد والصنف والمبلغ الإجمالي مطلوبين." };
      }
      const total = new Decimal(total_amount);
      const paid = new Decimal(paid_amount ?? total_amount);
      const remaining = total.sub(paid);
      const supplierNameStr = String(supplier_name).trim();
      const supplier = await prisma.supplier.upsert({
        where: { name: supplierNameStr },
        update: {},
        create: { name: supplierNameStr }
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
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return "⚠️ مفتاح Gemini API غير متاح في النظام حالياً.";
  }

  const companyStr = tenantName ? `بشركة ${tenantName}` : "بنظامنا الذكي";
  const typeStr = businessType ? `(نوع النشاط: ${businessType})` : "";
  const hoursStr = workingHours ? `(مواعيد العمل: ${workingHours})` : "";
  const systemInstruction = `أنت المساعد الشخصي الذكي الخاص بمدير أو صاحب العمل ${companyStr} ${typeStr} ${hoursStr}.
تحدث بالعامية المصرية الحية والراقية مباشرة وسريعة.
إذا طلب العميل تسجيل بيع، مصروف، موعد، أو مشتريات، استخدم الأداة المناسبة فوراً.
إذا نفذت أداة بنجاح، أكد العملية للعميل بجملة ودية مختصرة.
إذا سألك العميل عن مواعيد العمل أو نوع النشاط، استخدم البيانات المتاحة أعلاه للرد بدقة.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      tools: [{ functionDeclarations: [logSaleTool, logExpenseTool, bookAppointmentTool, logPurchaseTool] }],
      systemInstruction
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(text);
    const response = result.response;
    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const toolRes = await executeTool(call.name, call.args, tenantId);
      
      // Pass tool execution output back to LLM for final confirmation text
      const followUp = await chat.sendMessage([
        {
          functionResponse: {
            name: call.name,
            response: { result: toolRes.resultText }
          }
        }
      ]);
      return followUp.response.text().trim() || toolRes.resultText;
    }

    return response.text().trim() || "تمام يا فندم، أنا معاك.";
  } catch (err: any) {
    console.error("[Telegram LLM Process Error]:", err);
    return `💡 حصلت مشكلة بسيطة في معالجة الرسالة، جرب تاني يا فندم.\n\n\`تفاصيل الخطأ: ${err?.message || String(err)}\``;
  }
}

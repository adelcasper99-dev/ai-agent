// lib/telegram_fallback.ts
import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";
import { sendTelegramAlert } from "./telegram";

const prisma = new PrismaClient();

const STATE_TTL_MINUTES = 60;

export async function sendTelegramMessageOrEdit(
  chatId: string,
  text: string,
  replyMarkup?: any,
  messageId?: number
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  if (messageId) {
    // Edit existing message for seamless Telegram UI
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: "Markdown",
          reply_markup: replyMarkup,
        }),
      });
      const data = await res.json();
      if (data.ok) return;
    } catch {
      // Fallback to sending new message if edit fails
    }
  }

  await sendTelegramAlert({
    chatId,
    text,
    replyMarkup,
    idempotencyKey: `fallback_msg:${chatId}:${Date.now()}`,
  });
}

export async function sendFallbackMainMenu(chatId: string, messageId?: number) {
  const text = "🚨 *وضع الطوارئ (بدون الذكاء الاصطناعي)*\n\nجميع خدمات الذكاء الاصطناعي متوقفة حالياً. يمكنك استخدام القوائم المباشرة التالية لإدارة أعمالك:";
  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "💰 مبيعات", callback_data: "menu:sale" },
        { text: "📦 مشتريات (قريباً)", callback_data: "menu:soon" },
      ],
      [
        { text: "💸 مصروف (قريباً)", callback_data: "menu:soon" },
        { text: "📝 آجل (قريباً)", callback_data: "menu:soon" },
      ],
      [
        { text: "📊 حسابات (قريباً)", callback_data: "menu:soon" },
        { text: "👷 موظفين (قريباً)", callback_data: "menu:soon" },
      ],
      [
        { text: "📅 مواعيد (قريباً)", callback_data: "menu:soon" },
        { text: "📈 تقارير (قريباً)", callback_data: "menu:soon" },
      ],
      [{ text: "🙋 دعم بشري", callback_data: "cmd_human" }],
    ],
  };

  await sendTelegramMessageOrEdit(chatId, text, replyMarkup, messageId);
}

export async function getActiveConversationState(chatId: string, tenantId: string) {
  let state = await (prisma as any).conversationState.findUnique({
    where: { telegramChatId: chatId },
  });

  if (state) {
    // TTL Check: Reset if state is older than 60 minutes
    const diffMins = (Date.now() - new Date(state.updatedAt).getTime()) / (1000 * 60);
    if (diffMins > STATE_TTL_MINUTES) {
      state = await (prisma as any).conversationState.update({
        where: { id: state.id },
        data: { currentFlow: null, currentStep: null, collectedData: "{}" },
      });
    }
  } else {
    state = await (prisma as any).conversationState.create({
      data: {
        tenantId,
        telegramChatId: chatId,
        currentFlow: null,
        currentStep: null,
        collectedData: "{}",
      },
    });
  }

  return state;
}

export async function resetFallbackState(chatId: string) {
  await (prisma as any).conversationState.updateMany({
    where: { telegramChatId: chatId },
    data: { currentFlow: null, currentStep: null, collectedData: "{}" },
  });
}

export function tryParseQuickSale(text: string): { success: boolean; data?: any } {
  const trimmed = text.trim();
  if (!trimmed) return { success: false };

  // Check if text contains at least one number
  const numbers = trimmed.match(/\d+(\.\d+)?/g);
  if (!numbers || numbers.length === 0) return { success: false };

  const isCredit = /آجل|على الحساب|اجل|دين/i.test(trimmed);
  const payment_method = isCredit ? "credit" : "cash";
  const payment_label = isCredit ? "آجل" : "كاش";

  let quantity = 1;
  let total_price = 0;

  if (numbers.length >= 2) {
    quantity = parseInt(numbers[0], 10) || 1;
    total_price = parseFloat(numbers[1]);
  } else {
    total_price = parseFloat(numbers[0]);
  }

  if (isNaN(total_price) || total_price <= 0) return { success: false };

  // Strip keywords and prepositions
  let cleanText = trimmed
    .replace(/آجل|على الحساب|اجل|دين|كاش|نقدي/gi, '')
    .replace(/\b(بـ|ب)\b/g, ' ')
    .trim();

  // Extract non-numeric tokens for item & customer names
  let words = cleanText.split(/\s+/).filter(w => !/^\d+(\.\d+)?$/.test(w) && w.length > 0 && w !== "بـ" && w !== "ب");

  if (words.length === 0) return { success: false };

  let item_name = words[0];
  let customer_name = isCredit ? "" : "عميل نقدي";

  if (words.length > 1) {
    if (isCredit) {
      customer_name = words[words.length - 1];
      item_name = words.slice(0, words.length - 1).join(" ");
    } else {
      item_name = words.join(" ");
    }
  }

  if (!item_name) return { success: false };

  return {
    success: true,
    data: {
      item_name,
      quantity,
      total_price,
      customer_name: customer_name || "عميل نقدي",
      payment_method,
      payment_label
    }
  };
}

export async function handleFallbackMenuCallback(
  chatId: string,
  tenantId: string,
  data: string,
  messageId?: number
) {
  if (data === "menu:soon") {
    await sendTelegramMessageOrEdit(chatId, "ℹ️ هذه الميزة قيد التطوير وستكون متاحة في وضع الطوارئ قريباً!", undefined, messageId);
    return;
  }

  if (data === "menu:sale") {
    await (prisma as any).conversationState.upsert({
      where: { telegramChatId: chatId },
      update: { currentFlow: "sale", currentStep: "customer", collectedData: "{}" },
      create: { tenantId, telegramChatId: chatId, currentFlow: "sale", currentStep: "customer", collectedData: "{}" },
    });

    const text = "💰 *تسجيل مبيعات جديدة*\n\n⚡ *إدخال سريع (سطر واحد):*\nاكتب الجملة كاملة واستلم التعديل والـ Confirm فوراً!\n📌 *أمثلة:* `مفاتيح 300` أو `2 كرتونة مسامير 500 احمد آجل`\n\nأو اضغط زرار (عميل نقدي) للبدء بالتفصيل:";
    const replyMarkup = {
      inline_keyboard: [
        [{ text: "💵 عميل نقدي (بدء التخصيص)", callback_data: "sale:cash_customer" }],
        [{ text: "❌ إلغاء", callback_data: "sale:cancel" }],
      ],
    };

    await sendTelegramMessageOrEdit(chatId, text, replyMarkup, messageId);
  }
}

// ── 2. FALLBACK INPUT TEXT PROCESSOR (STATE MACHINE) ──
export async function processFallbackInput(
  chatId: string,
  tenantId: string,
  text: string,
  currentState: any
): Promise<boolean> {
  // ⚡ 1. Try Quick 1-Line Sale Parse unconditionally first (even if currentFlow is null)!
  const quickResult = tryParseQuickSale(text);
  if (quickResult.success && quickResult.data) {
    const qData = quickResult.data;
    if (qData.payment_method === "credit" && (!qData.customer_name || qData.customer_name === "عميل نقدي")) {
      await sendTelegramAlert({
        chatId,
        text: "⚠️ *عذراً، البيع الآجل يتطلب تحديد اسم العميل!*\nيرجى إعادة كتابة الحركة شاملة اسم العميل (مثال: `2 مسامير 500 احمد آجل`).",
        idempotencyKey: `fb_val_cred:${chatId}:${Date.now()}`
      });
      return true;
    }

    await (prisma as any).conversationState.upsert({
      where: { telegramChatId: chatId },
      update: { tenantId, currentFlow: "sale", currentStep: "confirm", collectedData: JSON.stringify(qData) },
      create: { tenantId, telegramChatId: chatId, currentFlow: "sale", currentStep: "confirm", collectedData: JSON.stringify(qData) },
    });

    const summary = `📝 *تأكيد عملية البيع (سريع)*\n\n👤 *العميل:* ${qData.customer_name}\n📦 *الصنف:* ${qData.item_name}\n🔢 *الكمية:* ${qData.quantity}\n💰 *الإجمالي:* ${qData.total_price} جنيه\n💳 *طريقة الدفع:* ${qData.payment_label}\n\nهل تريد تأكيد تسجيل العملية؟`;

    await sendTelegramAlert({
      chatId,
      text: summary,
      replyMarkup: {
        inline_keyboard: [
          [{ text: "✅ تأكيد البيع", callback_data: "sale:confirm:yes" }],
          [
            { text: "✏️ إعادة البدء", callback_data: "sale:confirm:edit" },
            { text: "❌ إلغاء", callback_data: "sale:cancel" },
          ],
        ],
      },
      idempotencyKey: `fb_quick:${chatId}:${Date.now()}`,
    });
    return true;
  }

  if (!currentState || !currentState.currentFlow) return false;

  const flow = currentState.currentFlow;
  const step = currentState.currentStep;
  let data: Record<string, any> = {};
  try {
    data = JSON.parse(currentState.collectedData || "{}");
  } catch {
    data = {};
  }
  if (flow === "sale") {
    // Step 1: Customer Name
    if (step === "customer") {
      const customerName = text.trim();
      if (!customerName) {
        await sendTelegramAlert({ chatId, text: "⚠️ يرجى إدخال اسم عميل صحيح أو الضغط على زرار عميل نقدي.", idempotencyKey: `fb_val:${chatId}:${Date.now()}` });
        return true;
      }

      data.customer_name = customerName;
      await (prisma as any).conversationState.update({
        where: { telegramChatId: chatId },
        data: { currentStep: "item", collectedData: JSON.stringify(data) },
      });

      await sendTelegramAlert({
        chatId,
        text: `العميل: *${customerName}*\n\nالخطوة 2 من 5: اكتب اسم الصنف / الخدمة المباعة:`,
        replyMarkup: { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "sale:cancel" }]] },
        idempotencyKey: `fb_cust:${chatId}:${Date.now()}`,
      });
      return true;
    }

    // Step 2: Item Name
    if (step === "item") {
      const itemName = text.trim();
      if (!itemName) {
        await sendTelegramAlert({ chatId, text: "⚠️ يرجى إدخال اسم صنف صحيح.", idempotencyKey: `fb_val:${chatId}:${Date.now()}` });
        return true;
      }

      data.item_name = itemName;
      await (prisma as any).conversationState.update({
        where: { telegramChatId: chatId },
        data: { currentStep: "quantity", collectedData: JSON.stringify(data) },
      });

      await sendTelegramAlert({
        chatId,
        text: `الصنف: *${itemName}*\n\nالخطوة 3 من 5: أدخل الكمية المباعة (أو اختار من الأزرار):`,
        replyMarkup: {
          inline_keyboard: [
            [
              { text: "1", callback_data: "sale:qty:1" },
              { text: "2", callback_data: "sale:qty:2" },
              { text: "3", callback_data: "sale:qty:3" },
              { text: "5", callback_data: "sale:qty:5" },
            ],
            [{ text: "❌ إلغاء", callback_data: "sale:cancel" }],
          ],
        },
        idempotencyKey: `fb_item:${chatId}:${Date.now()}`,
      });
      return true;
    }

    // Step 3: Quantity
    if (step === "quantity") {
      const qty = parseInt(text.trim(), 10);
      if (isNaN(qty) || qty <= 0) {
        await sendTelegramAlert({ chatId, text: "⚠️ يرجى إدخال كمية صحيحة (رقم موجب).", idempotencyKey: `fb_val:${chatId}:${Date.now()}` });
        return true;
      }

      data.quantity = qty;
      await (prisma as any).conversationState.update({
        where: { telegramChatId: chatId },
        data: { currentStep: "total_price", collectedData: JSON.stringify(data) },
      });

      await sendTelegramAlert({
        chatId,
        text: `الكمية: *${qty}*\n\nالخطوة 4 من 5: أدخل السعر الإجمالي (بالجنيه):`,
        replyMarkup: { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "sale:cancel" }]] },
        idempotencyKey: `fb_qty:${chatId}:${Date.now()}`,
      });
      return true;
    }

    // Step 4: Total Price
    if (step === "total_price") {
      const price = parseFloat(text.trim());
      if (isNaN(price) || price <= 0) {
        await sendTelegramAlert({ chatId, text: "⚠️ يرجى إدخال سعر صحيح (رقم موجب).", idempotencyKey: `fb_val:${chatId}:${Date.now()}` });
        return true;
      }

      data.total_price = price;
      await (prisma as any).conversationState.update({
        where: { telegramChatId: chatId },
        data: { currentStep: "payment_method", collectedData: JSON.stringify(data) },
      });

      await sendTelegramAlert({
        chatId,
        text: `السعر الإجمالي: *${price} جنيه*\n\nالخطوة 5 من 5: اختر طريقة الدفع:`,
        replyMarkup: {
          inline_keyboard: [
            [
              { text: "💵 كاش", callback_data: "sale:pay:cash" },
              { text: "📝 آجل", callback_data: "sale:pay:credit" },
              { text: "🏦 تحويل", callback_data: "sale:pay:transfer" },
            ],
            [{ text: "❌ إلغاء", callback_data: "sale:cancel" }],
          ],
        },
        idempotencyKey: `fb_price:${chatId}:${Date.now()}`,
      });
      return true;
    }
  }

  return false;
}

// ── 3. SALE CALLBACK HANDLER ──
export async function handleFallbackSaleCallback(
  chatId: string,
  tenantId: string,
  dataStr: string,
  messageId?: number
) {
  const currentState = await getActiveConversationState(chatId, tenantId);
  let data: Record<string, any> = {};
  try {
    data = JSON.parse(currentState.collectedData || "{}");
  } catch {
    data = {};
  }

  if (dataStr === "sale:cancel") {
    await resetFallbackState(chatId);
    await sendTelegramMessageOrEdit(chatId, "❌ تم إلغاء عملية البيع.", undefined, messageId);
    await sendFallbackMainMenu(chatId);
    return;
  }

  if (dataStr === "sale:cash_customer") {
    data.customer_name = "عميل نقدي";
    await (prisma as any).conversationState.update({
      where: { telegramChatId: chatId },
      data: { currentStep: "item", collectedData: JSON.stringify(data) },
    });

    await sendTelegramMessageOrEdit(
      chatId,
      "العميل: *عميل نقدي*\n\nالخطوة 2 من 5: اكتب اسم الصنف / الخدمة المباعة:",
      { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "sale:cancel" }]] },
      messageId
    );
    return;
  }

  if (dataStr.startsWith("sale:qty:")) {
    const qty = parseInt(dataStr.replace("sale:qty:", ""), 10) || 1;
    data.quantity = qty;
    await (prisma as any).conversationState.update({
      where: { telegramChatId: chatId },
      data: { currentStep: "total_price", collectedData: JSON.stringify(data) },
    });

    await sendTelegramMessageOrEdit(
      chatId,
      `الكمية: *${qty}*\n\nالخطوة 4 من 5: أدخل السعر الإجمالي (بالجنيه):`,
      { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "sale:cancel" }]] },
      messageId
    );
    return;
  }

  if (dataStr.startsWith("sale:pay:")) {
    const method = dataStr.replace("sale:pay:", "");
    const isCashCustomer = !data.customer_name || data.customer_name === "عميل نقدي";

    if (method === "credit" && isCashCustomer) {
      delete data.customer_name;
      await (prisma as any).conversationState.update({
        where: { telegramChatId: chatId },
        data: { currentStep: "customer", collectedData: JSON.stringify(data) },
      });

      await sendTelegramMessageOrEdit(
        chatId,
        "⚠️ *عذراً، البيع الآجل يتطلب تحديد اسم العميل!*\nلا يمكن تسجيل مبيعات آجل لحساب (عميل نقدي).\n\nالخطوة 1 من 5: يرجى كتابة اسم العميل الصريح أولاً:",
        { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "sale:cancel" }]] },
        messageId
      );
      return;
    }

    const methodLabels: Record<string, string> = {
      cash: "كاش",
      credit: "آجل",
      transfer: "تحويل بانكي",
    };
    const paymentLabel = methodLabels[method] || method;
    data.payment_method = method;
    data.payment_label = paymentLabel;

    await (prisma as any).conversationState.update({
      where: { telegramChatId: chatId },
      data: { currentStep: "confirm", collectedData: JSON.stringify(data) },
    });

    const summary = `📝 *تأكيد عملية البيع*\n\n👤 *العميل:* ${data.customer_name || "عميل نقدي"}\n📦 *الصنف:* ${data.item_name}\n🔢 *الكمية:* ${data.quantity}\n💰 *الإجمالي:* ${data.total_price} جنيه\n💳 *طريقة الدفع:* ${paymentLabel}\n\nهل تريد تأكيد تسجيل العملية؟`;

    await sendTelegramMessageOrEdit(
      chatId,
      summary,
      {
        inline_keyboard: [
          [{ text: "✅ تأكيد البيع", callback_data: "sale:confirm:yes" }],
          [
            { text: "✏️ إعادة البدء", callback_data: "sale:confirm:edit" },
            { text: "❌ إلغاء", callback_data: "sale:cancel" },
          ],
        ],
      },
      messageId
    );
    return;
  }

  if (dataStr === "sale:confirm:edit") {
    await (prisma as any).conversationState.update({
      where: { telegramChatId: chatId },
      data: { currentStep: "customer", collectedData: "{}" },
    });

    await sendTelegramMessageOrEdit(
      chatId,
      "🔄 *إعادة البدء*\n\nالخطوة 1 من 5: اكتب اسم العميل (أو اضغط زرار عميل نقدي):",
      {
        inline_keyboard: [
          [{ text: "💵 عميل نقدي", callback_data: "sale:cash_customer" }],
          [{ text: "❌ إلغاء", callback_data: "sale:cancel" }],
        ],
      },
      messageId
    );
    return;
  }

  if (dataStr === "sale:confirm:yes") {
    // Double submission lock check
    if (currentState.currentStep !== "confirm") return;

    // Instantly lock state
    await resetFallbackState(chatId);

    try {
      const resultText = await executeSaleFlow(tenantId, data);
      await sendTelegramMessageOrEdit(chatId, `🎉 *${resultText}*`, undefined, messageId);
    } catch (err: any) {
      console.error("[Fallback Sale Flow Error]", err);
      await sendTelegramMessageOrEdit(chatId, `❌ حدث خطأ أثناء تنفيذ عملية البيع: ${err?.message || "خطأ غير معروف"}`, undefined, messageId);
    }

    await sendFallbackMainMenu(chatId);
  }
}

// ── 4. DB EXECUTION FOR COMPLETED SALE ──
async function executeSaleFlow(tenantId: string, data: Record<string, any>): Promise<string> {
  const { customer_name, item_name, quantity = 1, total_price, payment_method } = data;

  const total = new Decimal(total_price);
  const qty = parseInt(quantity, 10) || 1;
  const isCredit = payment_method === "credit";
  const paid = isCredit ? new Decimal(0) : total;
  const deferred = isCredit ? total : new Decimal(0);
  const custName = customer_name ? String(customer_name).trim() : "عميل نقدي";

  const saleResult = await prisma.$transaction(async (tx) => {
    let customerId = null;

    if (custName) {
      let customer = await tx.customer.findFirst({
        where: { tenantId, name: custName },
      });
      if (!customer) {
        customer = await tx.customer.create({
          data: {
            name: custName,
            tenantId,
          },
        });
      }
      customerId = customer.id;
    }

    const sale = await tx.sale.create({
      data: {
        itemName: String(item_name).trim(),
        price: total.div(qty).toNumber(),
        quantity: qty,
        total: total.toNumber(),
        paidAmount: paid.toNumber(),
        deferredAmount: deferred.toNumber(),
        customerName: custName,
        ...(customerId && { customerId }),
        tenantId,
      },
    });

    if (customerId) {
      await tx.customerLedgerEntry.create({
        data: {
          customerId,
          saleId: sale.id,
          entryType: "SALE_DEBIT",
          amount: total.toNumber(),
          description: `فاتورة مبيعات (طوارئ): ${qty} ${sale.itemName}`,
          tenantId,
        },
      });

      if (paid.gt(0)) {
        await tx.customerLedgerEntry.create({
          data: {
            customerId,
            saleId: sale.id,
            entryType: "PAYMENT_CREDIT",
            amount: paid.toNumber(),
            description: `دفعة مسددة: ${sale.itemName}`,
            tenantId,
          },
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
          tenantId,
        },
      });
    }

    if (paid.gt(0)) {
      await tx.journalEntry.create({
        data: {
          accountCode: "CASH",
          debit: paid.toNumber(),
          referenceId: sale.id,
          description: `مقبوضات مبيعات: ${sale.itemName}`,
          tenantId,
        },
      });
    }

    await tx.journalEntry.create({
      data: {
        accountCode: "SALES_REVENUE",
        credit: total.toNumber(),
        referenceId: sale.id,
        description: `إيرادات مبيعات: ${sale.itemName}`,
        tenantId,
      },
    });

    return sale;
  });

  return `تم تسجيل بيع ${saleResult.quantity} ${saleResult.itemName} بقيمة إجمالية ${saleResult.total} جنيه (${data.payment_label || "كاش"}) بنجاح!`;
}

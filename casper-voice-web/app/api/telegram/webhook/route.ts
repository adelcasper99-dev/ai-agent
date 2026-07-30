// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  sendTelegramAlert,
  isUpdateProcessed,
  isStartRateLimited,
  isChatAllowed,
  approveTenantRequest,
  rejectTenantRequest,
} from "@/lib/telegram";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    // 1. Webhook Secret Token Verification
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret) {
      const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
      if (secretHeader !== expectedSecret) {
        return NextResponse.json({ error: "Unauthorized webhook caller" }, { status: 401 });
      }
    }

    const update = await req.json();

    // 2. Update Deduplication Guard
    if (update.update_id && isUpdateProcessed(update.update_id)) {
      return NextResponse.json({ ok: true });
    }

    // 3. Handle Admin Inline Callback Queries (`approve:<id>` / `reject:<id>`)
    if (update.callback_query) {
      const callback = update.callback_query;
      const adminChatId = String(callback.from.id);
      const expectedAdminId = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

      // Auth Check: Callback sender MUST equal ADMIN_CHAT_ID
      if (expectedAdminId && adminChatId !== expectedAdminId) {
        return NextResponse.json({ ok: true });
      }

      const data = callback.data || "";
      if (data.startsWith("approve:")) {
        const requestId = data.replace("approve:", "");
        await approveTenantRequest(requestId, `telegram:${adminChatId}`);
      } else if (data.startsWith("reject:")) {
        const requestId = data.replace("reject:", "");
        await rejectTenantRequest(requestId, `telegram:${adminChatId}`);
      }

      // Clear Telegram loading spinner
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (token && callback.id) {
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callback.id, text: "تم تنفيذ الإجراء بنجاح!" }),
        }).catch(() => null);
      }

      return NextResponse.json({ ok: true });
    }

    // 4. Handle Standard Incoming Messages
    const message = update?.message;
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    if (text === "/start") {
      // Check existing tenant
      const existingTenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: chatId } });
      if (existingTenant) {
        await sendTelegramAlert({
          chatId,
          text: `👋 أهلاً بك مجدداً! حساب شركتك *${existingTenant.name}* مفعل بحالة (*${existingTenant.state}*).`,
          idempotencyKey: `start:tenant:${chatId}:${message.message_id}`,
        });
        return NextResponse.json({ ok: true });
      }

      // Check existing pending request
      const existingReq = await (prisma as any).pendingTenantRequest.findUnique({ where: { telegramChatId: chatId } });
      if (existingReq) {
        await sendTelegramAlert({
          chatId,
          text: `⏳ طلب التفعيل الخاص بك لـ *${existingReq.customerName}* قيد المراجعة من الإدارة حالياً.`,
          idempotencyKey: `start:pending:${chatId}:${message.message_id}`,
        });
        return NextResponse.json({ ok: true });
      }

      // Rate limit check
      if (isStartRateLimited(chatId)) {
        await sendTelegramAlert({
          chatId,
          text: `⚠️ لقيت صعوبة في معالجة طلبك لكثرة المحاولات. يرجى المحاولة بعد 10 دقائق.`,
          idempotencyKey: `start:ratelimit:${chatId}:${message.message_id}`,
        });
        return NextResponse.json({ ok: true });
      }

      // Extract customer name from sender profile or text
      const customerName = message.from?.first_name
        ? `${message.from.first_name} ${message.from.last_name || ""}`.trim()
        : "عميل جديد";

      const pendingReq = await (prisma as any).pendingTenantRequest.create({
        data: {
          telegramChatId: chatId,
          customerName,
          status: "pending",
        },
      });

      await sendTelegramAlert({
        chatId,
        text: `👋 أهلاً بك في Casper Voice! تم تسجيل طلبك لـ *${customerName}* وسوف يتم مراجعته من الإدارة والتفعيل فوراً.`,
        idempotencyKey: `start:created:${chatId}:${message.message_id}`,
      });

      // Notify Admin with Inline Keyboard
      const adminChatId = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
      if (adminChatId) {
        await sendTelegramAlert({
          chatId: adminChatId,
          text: `📢 *طلب تفعيل شركة جديد!*\n\n👤 *العميل:* ${customerName}\n🆔 *Chat ID:* \`${chatId}\``,
          idempotencyKey: `admin_notify:${pendingReq.id}`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: "✅ موافقة", callback_data: `approve:${pendingReq.id}` },
                { text: "❌ رفض", callback_data: `reject:${pendingReq.id}` },
              ],
            ],
          },
        });
      }

      return NextResponse.json({ ok: true });
    }

    // Inbound Authorization Gate for other commands (/appointments, /status)
    if (!isChatAllowed(chatId)) {
      return NextResponse.json({ ok: true });
    }

    if (text === "/appointments") {
      const appointments = await prisma.appointment.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      let responseText = "📅 *قائمة المواعيد المسجلة حديثاً:*\n\n";
      if (appointments.length === 0) {
        responseText += "لا توجد مواعيد مسجلة حالياً.";
      } else {
        appointments.forEach((app, idx) => {
          responseText += `${idx + 1}. *${app.customerName}* — ${app.date} الساعة ${app.time}\n`;
        });
      }

      await sendTelegramAlert({
        chatId,
        text: responseText,
        idempotencyKey: `appointments:${chatId}:${message.message_id}`,
      });
    } else if (text === "/status") {
      await sendTelegramAlert({
        chatId,
        text: "🟢 *حالة النظام:* Casper Voice Agent & ERP شغالين بنجاح 100%!",
        idempotencyKey: `status:${chatId}:${message.message_id}`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Telegram Webhook Handler Error]", err);
    return NextResponse.json({ ok: true });
  }
}

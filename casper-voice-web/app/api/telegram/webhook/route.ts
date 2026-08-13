import { prisma } from "@/lib/prisma";
// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  sendTelegramAlert,
  isUpdateProcessed,
  isStartRateLimited,
  isChatAllowed,
  getAdminChatId,
  approveTenantRequest,
  rejectTenantRequest,
  approveDirectTenant,
  rejectDirectTenant,
  setTelegramBotCommands,
} from "@/lib/telegram";
import { z } from "zod";
import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import {
  sendFallbackMainMenu,
  getActiveConversationState,
  handleFallbackMenuCallback,
  handleFallbackSaleCallback,
  processFallbackInput,
} from "@/lib/telegram_fallback";
import { correctTranscriptWithLLM } from "@/lib/llm_correction";
import { transcribeVoiceNote, processImage } from "@/lib/conversation.service";

import { buildWhisperPrompt } from "@/lib/whisper_prompt";


export async function POST(req: NextRequest) {
  try {
    // 1. Webhook Secret Token Verification — fail closed if TELEGRAM_WEBHOOK_SECRET unset
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expectedSecret) {
      console.error('[telegram/webhook] TELEGRAM_WEBHOOK_SECRET is not set — rejecting all requests.');
      return NextResponse.json({ error: 'Service misconfigured' }, { status: 503 });
    }
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    if (secretHeader !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized webhook caller" }, { status: 401 });
    }

    const rawUpdate = await req.json();

    const telegramUpdateSchema = z.object({
      update_id: z.number(),
      message: z.object({
        message_id: z.number().optional(),
        from: z.object({ id: z.number(), first_name: z.string().optional(), last_name: z.string().optional() }).passthrough().optional(),
        chat: z.object({ id: z.number() }).passthrough().optional(),
        text: z.string().optional(),
        voice: z.object({ file_id: z.string() }).passthrough().optional(),
        photo: z.array(z.object({ file_id: z.string() }).passthrough()).optional(),
        document: z.object({ file_id: z.string(), mime_type: z.string().optional() }).passthrough().optional(),
      }).passthrough().optional(),
      business_message: z.object({
        message_id: z.number().optional(),
        business_connection_id: z.string(),
        from: z.object({ id: z.number(), first_name: z.string().optional() }).passthrough(),
        chat: z.object({ id: z.number() }).passthrough(),
        text: z.string().optional(),
        voice: z.any().optional(),
      }).passthrough().optional(),
      business_connection: z.object({
        id: z.string(),
        user: z.object({ id: z.number() }).passthrough(),
        is_disabled: z.boolean().optional(),
      }).passthrough().optional(),
      callback_query: z.any().optional(),
    }).passthrough();
    
    const update = telegramUpdateSchema.parse(rawUpdate);

    // 2. Update Deduplication Guard
    if (update.update_id) {
      if (isUpdateProcessed(update.update_id)) {
        return NextResponse.json({ ok: true });
      }
      try {
        const updateId = BigInt(update.update_id);
        await (prisma as any).processedUpdate.create({ data: { updateId } });
      } catch {
        // Unique constraint violation = already processed
        return NextResponse.json({ ok: true });
      }
    }

    // 3. Handle Admin & Onboarding Callback Queries
    if (update.callback_query) {
      const callback = update.callback_query;
      const callbackChatId = String(callback.from.id);
      const data = callback.data || "";

      const answerCallback = async (text: string) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (token && callback.id) {
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: callback.id, text }),
          }).catch(() => null);
        }
      };

      if (data.startsWith("c:")) {
        await answerCallback("جاري التنفيذ... 🚀");
        const parts = data.split(":");
        const actionType = parts[1]; // "p", "cancel", "type"

        const tenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: callbackChatId } });
        if (tenant) {
          let choiceNum = "1";
          if (actionType === "p") {
            choiceNum = parts[2] === "tot" ? "1" : "2";
          } else if (actionType === "cancel") {
            choiceNum = parts[2] === "yes" ? "1" : "2";
          } else if (actionType === "type") {
            choiceNum = parts[2] === "purchase" ? "1" : "2";
          }

          const processRes = await processTelegramMessageWithLLM(
            choiceNum,
            tenant.id,
            tenant.merchantName || undefined,
            tenant.businessType || undefined,
            tenant.workingHours || undefined,
            callbackChatId
          );

          const resultText = (processRes as any).text || "تم تنفيذ الاختيار بنجاح ✅";
          if (callback.message?.message_id) {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            if (token) {
              await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: callbackChatId,
                  message_id: callback.message.message_id,
                  text: resultText
                })
              }).catch(() => null);
            }
          }
        }
        return NextResponse.json({ ok: true });
      }

      const isTenantCommand = data.startsWith("menu:") || data.startsWith("sale:") || data.startsWith("cmd_");
      if (isTenantCommand) {
        const tenantCheck = await (prisma as any).tenant.findUnique({ where: { telegramChatId: callbackChatId } });
        if (tenantCheck && tenantCheck.state !== "active") {
          await answerCallback("⚠️ حسابك غير مفعل حالياً.");
          return NextResponse.json({ ok: true });
        }
      }

      if (data.startsWith("menu:")) {
        const tenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: callbackChatId } });
        if (tenant) {
          await handleFallbackMenuCallback(callbackChatId, tenant.id, data, callback.message?.message_id);
        }
        await answerCallback("جاري فتح القائمة...");
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith("sale:")) {
        const tenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: callbackChatId } });
        if (tenant) {
          await handleFallbackSaleCallback(callbackChatId, tenant.id, data, callback.message?.message_id);
        }
        await answerCallback("تم الاختيار!");
        return NextResponse.json({ ok: true });
      }

      if (data === "agree_terms") {
        const tenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: callbackChatId } });
        if (tenant && tenant.state === "pending_agreement") {
          await (prisma as any).tenant.update({
            where: { id: tenant.id },
            data: { state: "onboarding_merchant_name" },
          });
          await sendTelegramAlert({
            chatId: callbackChatId,
            text: "تمام! نتعرف بحضرتك الأول، اسمك إيه؟ (مثال: محمود)",
            idempotencyKey: `onboarding:merchant_name_prompt:${callbackChatId}`,
          });
        }
        await answerCallback("تم القبول!");
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith("type:")) {
        const typeVal = data.replace("type:", "");
        const tenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: callbackChatId } });
        if (tenant) {
          if (typeVal === "custom") {
            await (prisma as any).tenant.update({
              where: { id: tenant.id },
              data: { state: "onboarding_type_custom" },
            });
            await sendTelegramAlert({
              chatId: callbackChatId,
              text: "تمام يا فندم، اكتب نوع نشاطك/بيزنسك بنفسك دلوقتي:",
              idempotencyKey: `type:custom_prompt:${callbackChatId}`,
            });
          } else {
            const labelMap: Record<string, string> = {
              restaurant: "🍔 مطعم/كافيه",
              clinic: "🏥 عيادة/مركز طبي",
              beauty: "💇 صالون/تجميل",
              store: "🛍️ متجر/محل",
              services: "🔧 خدمات عامة",
            };
            const businessTypeLabel = labelMap[typeVal] || typeVal;
            await (prisma as any).tenant.update({
              where: { id: tenant.id },
              data: { businessType: businessTypeLabel, state: "onboarding_working_days" },
            });

            await sendTelegramAlert({
              chatId: callbackChatId,
              text: `ممتاز (${businessTypeLabel})! قولي أيام العمل في الأسبوع:`,
              idempotencyKey: `onboarding:days_prompt:${callbackChatId}`,
              replyMarkup: {
                inline_keyboard: [
                  [
                    { text: "📅 كل يوم", callback_data: "days:all_week" },
                    { text: "📅 السبت - الخميس", callback_data: "days:sat_thu" },
                  ],
                  [
                    { text: "📅 الاثنين - السبت", callback_data: "days:mon_sat" },
                    { text: "✏️ تحديد مخصص", callback_data: "days:custom" },
                  ],
                ],
              },
            });
          }
        }
        await answerCallback("تم الاختيار!");
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith("days:")) {
        const daysVal = data.replace("days:", "");
        const tenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: callbackChatId } });
        if (tenant) {
          if (daysVal === "custom") {
            await (prisma as any).tenant.update({
              where: { id: tenant.id },
              data: { state: "onboarding_days_custom" },
            });
            await sendTelegramAlert({
              chatId: callbackChatId,
              text: "اكتب أيام العمل المخصصة بنفسك (مثال: الأحد إلى الخميس):",
              idempotencyKey: `days:custom_prompt:${callbackChatId}`,
            });
          } else {
            const daysMap: Record<string, string> = {
              all_week: "طوال الأسبوع (7 أيام)",
              sat_thu: "السبت إلى الخميس",
              mon_sat: "الاثنين إلى السبت",
            };
            const daysLabel = daysMap[daysVal] || daysVal;
            await (prisma as any).tenant.update({
              where: { id: tenant.id },
              data: { workingHours: daysLabel, state: "onboarding_working_hours" },
            });

            await sendTelegramAlert({
              chatId: callbackChatId,
              text: `تمام (${daysLabel})! اختار نطاق ساعات العمل اليومية:`,
              idempotencyKey: `onboarding:hours_prompt:${callbackChatId}`,
              replyMarkup: {
                inline_keyboard: [
                  [
                    { text: "⏰ 9ص - 5م", callback_data: "hours:9_5" },
                    { text: "⏰ 10ص - 10م", callback_data: "hours:10_10" },
                  ],
                  [
                    { text: "⏰ 12م - 12ص", callback_data: "hours:12_12" },
                    { text: "⏰ 24 ساعة", callback_data: "hours:24_7" },
                  ],
                  [{ text: "✏️ وقت مخصص", callback_data: "hours:custom" }],
                ],
              },
            });
          }
        }
        await answerCallback("تم الاختيار!");
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith("hours:")) {
        const hoursVal = data.replace("hours:", "");
        const tenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: callbackChatId } });
        if (tenant) {
          if (hoursVal === "custom") {
            await (prisma as any).tenant.update({
              where: { id: tenant.id },
              data: { state: "onboarding_hours_custom" },
            });
            await sendTelegramAlert({
              chatId: callbackChatId,
              text: "اكتب ساعات العمل المخصصة (مثال: من 8 صباحاً حتى 4 عصراً):",
              idempotencyKey: `hours:custom_prompt:${callbackChatId}`,
            });
          } else {
            const hoursMap: Record<string, string> = {
              "9_5": "من 9 صباحاً إلى 5 مساءً",
              "10_10": "من 10 صباحاً إلى 10 مساءً",
              "12_12": "من 12 ظهراً إلى 12 منتصف الليل",
              "24_7": "على مدار 24 ساعة",
            };
            const timeLabel = hoursMap[hoursVal] || hoursVal;
            const fullHoursStr = `${tenant.workingHours || "يومياً"} (${timeLabel})`;

            const updatedTenant = await (prisma as any).tenant.update({
              where: { id: tenant.id },
              data: { workingHours: fullHoursStr, state: "pending_approval" },
            });

            await sendTelegramAlert({
              chatId: callbackChatId,
              text: `📝 *تم تسجيل بيانات نشاطك بنجاح!*\n\n🏢 *الشركة:* ${updatedTenant.name}\n💼 *النشاط:* ${updatedTenant.businessType || "عام"}\n⏰ *المواعيد:* ${fullHoursStr}\n\n⏳ *طلبك الآن قيد مراجعة الإدارة.* سنرسل لك إشعاراً فور التفعيل والتأكيد.`,
              idempotencyKey: `onboarding:pending:${callbackChatId}`,
            });

            const adminChatId = await getAdminChatId();
            if (adminChatId) {
              await sendTelegramAlert({
                chatId: adminChatId,
                text: `📋 *طلب تفعيل شركة جديد عبر البوت!*\n\n🏢 *الشركة:* ${updatedTenant.name}\n💼 *النشاط:* ${updatedTenant.businessType || "عام"}\n⏰ *المواعيد:* ${fullHoursStr}\n🆔 *Chat ID:* \`${callbackChatId}\``,
                idempotencyKey: `admin_approval_tenant:${updatedTenant.id}`,
                replyMarkup: {
                  inline_keyboard: [
                    [
                      { text: "✅ موافقة وتفعيل", callback_data: `approve_tenant:${updatedTenant.id}` },
                      { text: "❌ رفض الطلب", callback_data: `reject_tenant:${updatedTenant.id}` },
                    ],
                  ],
                },
              });
            }
          }
        }
        await answerCallback("تم الحفظ بنجاح!");
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith("csat:")) {
        const rating = data.replace("csat:", "");
        const ratingInt = parseInt(rating, 10);
        if (!isNaN(ratingInt) && ratingInt >= 1 && ratingInt <= 5) {
          const csatTenant = await (prisma as any).tenant.findUnique({
            where: { telegramChatId: callbackChatId },
          });
          await (prisma as any).csatRating.create({
            data: {
              telegramChatId: callbackChatId,
              rating: ratingInt,
              tenantId: csatTenant?.id ?? null,
            },
          }).catch(() => null);
        }
        await answerCallback(`شكراً جزيلاً! تم تسجيل تقييمك (${rating}/5) بنجاح ⭐`);
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith("resolve:")) {
        const targetCustomerChatId = data.replace("resolve:", "");
        if (targetCustomerChatId) {
          await sendTelegramAlert({
            chatId: targetCustomerChatId,
            text: "✅ *تم إغلاق طلب الدعم الفني الخاص بك بواسطة موظف الدعم.*\n\nكيف كانت تجربتك معنا؟ يرجى تقييم الخدمة من الأزرار التالية:",
            idempotencyKey: `resolve:csat_prompt:${targetCustomerChatId}`,
            replyMarkup: {
              inline_keyboard: [
                [
                  { text: "⭐ 1", callback_data: "csat:1" },
                  { text: "⭐ 2", callback_data: "csat:2" },
                  { text: "⭐ 3", callback_data: "csat:3" },
                  { text: "⭐ 4", callback_data: "csat:4" },
                  { text: "⭐ 5", callback_data: "csat:5" },
                ],
              ],
            },
          });
        }
        await answerCallback("تم إرسال طل طلب التقييم للعميل بنجاح!");
        return NextResponse.json({ ok: true });
      }

      if (data === "cmd_menu") {
        await sendFallbackMainMenu(callbackChatId);
        await answerCallback("تم فتح القائمة!");
        return NextResponse.json({ ok: true });
      }

      if (data === "cmd_appointments") {
        const apptTenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: callbackChatId } });
        if (!apptTenant) {
          await answerCallback("⚠️ لم يتم العثور على شركتك.");
          return NextResponse.json({ ok: true });
        }
        const appointments = await prisma.appointment.findMany({
          where: { tenantId: apptTenant.id },
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
          chatId: callbackChatId,
          text: responseText,
          idempotencyKey: `appointments_btn:${callbackChatId}:${Date.now()}`,
        });
        await answerCallback("تم جلب المواعيد!");
        return NextResponse.json({ ok: true });
      }

      if (data === "cmd_human") {
        const currentTenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: callbackChatId } });
        await sendTelegramAlert({
          chatId: callbackChatId,
          text: "⏳ *تم توجيه طلبك لأحد ممثلي الدعم الفني*، وسيقوم بالرد عليك في أقرب وقت ممكن.",
          idempotencyKey: `escalate:customer_btn:${callbackChatId}:${Date.now()}`,
        });

        const adminChatId = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
        if (adminChatId) {
          await sendTelegramAlert({
            chatId: adminChatId,
            text: `🚨 *طلب تصعيد دعم فني جديد!*\n\n👤 *العميل:* ${callback.from?.first_name || "عميل"}\n🆔 *Chat ID:* \`${callbackChatId}\`\n💬 *الشركة:* ${currentTenant?.name || "غير مسجل"}`,
            idempotencyKey: `escalate:admin_notify_btn:${callbackChatId}:${Date.now()}`,
            replyMarkup: {
              inline_keyboard: [
                [{ text: "✅ إغلاق وسؤال رأي العميل", callback_data: `resolve:${callbackChatId}` }],
              ],
            },
          });
        }
        await answerCallback("تم طلب موظف الدعم!");
        return NextResponse.json({ ok: true });
      }

      const expectedAdminId = await getAdminChatId();
      // Auth Check: Admin Callback sender MUST equal ADMIN_CHAT_ID from DB or env
      if (!expectedAdminId || callbackChatId !== expectedAdminId) {
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith("approve_tenant:")) {
        const tenantId = data.replace("approve_tenant:", "");
        await approveDirectTenant(tenantId, `telegram:${callbackChatId}`);
      } else if (data.startsWith("reject_tenant:")) {
        const tenantId = data.replace("reject_tenant:", "");
        await rejectDirectTenant(tenantId, `telegram:${callbackChatId}`);
      } else if (data.startsWith("approve:")) {
        const requestId = data.replace("approve:", "");
        await approveTenantRequest(requestId, `telegram:${callbackChatId}`);
      } else if (data.startsWith("reject:")) {
        const requestId = data.replace("reject:", "");
        await rejectTenantRequest(requestId, `telegram:${callbackChatId}`);
      }

      await answerCallback("تم تنفيذ الإجراء بنجاح!");
      return NextResponse.json({ ok: true });
    }

    // 3.5 Business connection lifecycle (link/unlink)
    if (update.business_connection) {
      const conn = update.business_connection;
      const ownerUserId = String(conn.user.id);

      const tenant = await (prisma as any).tenant.findUnique({
        where: { ownerTelegramUserId: ownerUserId },
      });

      if (tenant) {
        await (prisma as any).tenant.update({
          where: { id: tenant.id },
          data: {
            businessConnectionId: conn.id,
            businessConnectionActive: !conn.is_disabled,
          },
        });
      } else {
        await (prisma as any).pendingBusinessConnection.upsert({
          where: { telegramUserId: ownerUserId },
          create: {
            telegramUserId: ownerUserId,
            connectionId: conn.id,
            isDisabled: conn.is_disabled ?? false,
          },
          update: {
            connectionId: conn.id,
            isDisabled: conn.is_disabled ?? false,
          },
        });
      }

      return NextResponse.json({ ok: true });
    }

    // 3.6 Customer message via Business connection
    if (update.business_message) {
      const msg = update.business_message;
      const connectionId = msg.business_connection_id;

      const tenant = await (prisma as any).tenant.findUnique({
        where: { businessConnectionId: connectionId },
      });

      if (!tenant || !tenant.businessConnectionActive || tenant.state !== "active") {
        return NextResponse.json({ ok: true }); // ignore stale/unknown/inactive connection
      }

      const customerTelegramId = String(msg.from.id);

      let customer;
      try {
        customer = await (prisma as any).customer.upsert({
          where: {
            tenantId_telegramUserId: {
              tenantId: tenant.id,
              telegramUserId: customerTelegramId,
            },
          },
          create: {
            tenantId: tenant.id,
            telegramUserId: customerTelegramId,
            name: msg.from.first_name ?? null,
          },
          update: {},
        });
      } catch (e: any) {
        if (e?.code === "P2002") {
          customer = await (prisma as any).customer.findUnique({
            where: {
              tenantId_telegramUserId: {
                tenantId: tenant.id,
                telegramUserId: customerTelegramId,
              },
            },
          });
        } else {
          throw e;
        }
      }

      await handleCustomerMessage({
        tenant,
        customer,
        text: msg.text,
        voice: msg.voice,
        sendVia: { businessConnectionId: connectionId, chatId: msg.chat.id },
      });

      return NextResponse.json({ ok: true });
    }

    // 4. Handle Standard Incoming Messages
    const message = update?.message;
    if (!message || !message.chat || !message.from) {
      return NextResponse.json({ ok: true });
    }

    let text = (message.text || "").trim();
    const chatId = String(message.chat.id);
    const senderId = String(message.from.id);

    // Top-Level State Check Guard (Suspension / Pending Approval)
    const existingDirectTenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: chatId } });
    if (existingDirectTenant) {
      if (existingDirectTenant.state === "suspended" || existingDirectTenant.state === "cancelled" || existingDirectTenant.state === "rejected") {
        await sendTelegramAlert({
          chatId,
          text: "⚠️ *تنبيه:* حساب شركتك موقوف حالياً. يرجى التواصل مع الدعم الفني للإدارة لإعادة التفعيل.",
          idempotencyKey: `suspended_notice:${chatId}:${Math.floor(Date.now() / 60000)}`,
        });
        return NextResponse.json({ ok: true });
      }
      if (existingDirectTenant.state === "pending_approval") {
        await sendTelegramAlert({
          chatId,
          text: "⏳ *طلبك قيد المراجعة:* تم إرسال بيانات نشاطك للإدارة، وسنقوم بإشعارات فور الموافقة والتفعيل.",
          idempotencyKey: `pending_notice:${chatId}:${Math.floor(Date.now() / 60000)}`,
        });
        return NextResponse.json({ ok: true });
      }
    }

    // Ensure bot commands menu is up to date in Telegram
    setTelegramBotCommands().catch(() => null);

    // 4a-bis. Check for Telegram Business Setup Code linking (e.g. /start biz_xyz or /setup biz_xyz)
    if (text.startsWith('/start ') || text.startsWith('/setup ')) {
      const parts = text.split(' ');
      const setupCode = parts[1];
      if (setupCode && !/^\d{4}$/.test(setupCode)) {
        const linkedTenant = await (prisma as any).tenant.updateMany({
          where: { setupCode: setupCode },
          data: {
            ownerTelegramUserId: senderId,
            ownerTelegramChatId: chatId,
            setupCode: null,
          },
        });

        if (linkedTenant.count > 0) {
          const pending = await (prisma as any).pendingBusinessConnection.findUnique({
            where: { telegramUserId: senderId },
          });

          if (pending) {
            await (prisma as any).tenant.updateMany({
              where: { ownerTelegramUserId: senderId },
              data: {
                businessConnectionId: pending.connectionId,
                businessConnectionActive: !pending.isDisabled,
              },
            });
            await (prisma as any).pendingBusinessConnection.delete({
              where: { telegramUserId: senderId },
            });
          }
          
          await sendTelegramAlert({
            chatId,
            text: `✅ *تم ربط حسابك بـ Telegram Business بنجاح!*`,
            idempotencyKey: `biz_link_success:${chatId}:${Date.now()}`,
          });
          return NextResponse.json({ ok: true });
        }
      }
    }

    if (text === '/setup') {
      const tenant = await (prisma as any).tenant.findUnique({ where: { ownerTelegramUserId: senderId } });
      if (tenant) {
        await sendTelegramAlert({
          chatId,
          text: `📱 *حالة ربط Telegram Business:*\n\n🏢 *الشركة:* ${tenant.name}\n🔗 *حالة الربط:* ${tenant.businessConnectionActive ? "🟢 مفعل ونشط" : "🔴 غير مرتبط"}\n\nلإعادة ربط حسابك، قم بتوليد كود جديد من لوحة التحكم، واضغط على رابط التفعيل المباشر.`,
          idempotencyKey: `setup_cmd_info:${chatId}:${Date.now()}`,
        });
      } else {
        await sendTelegramAlert({
          chatId,
          text: `📱 *ربط حساب Telegram Business*\n\nلربط حسابك بشركتك على Casper POS:\n1️⃣ افتح لوحة التحكم وانتقل للإعدادات.\n2️⃣ اضغط على *إنشاء كود جديد*.\n3️⃣ اضغط على رابط التفعيل المباشر ليتم الربط تلقائياً!\n\nأو أرسل الكود هنا بالشكل: \`/setup YOUR_CODE\``,
          idempotencyKey: `setup_cmd_instructions:${chatId}:${Date.now()}`,
        });
      }
      return NextResponse.json({ ok: true });
    }

    // 4a. Check if incoming text is a 4-digit linking PIN (e.g. "0417" or "/start 0417")
    const pinMatch = text.match(/^(?:\/start\s+)?(\d{4})$/);
    if (pinMatch) {
      const code = pinMatch[1];

      if (isStartRateLimited(chatId)) {
        await sendTelegramAlert({
          chatId,
          text: "⚠️ تم تجاوز عدد محاولات إدخال الرمز مسبقاً. يرجى الانتظار 15 دقيقة والتجربة لاحقاً.",
          idempotencyKey: `link_rate_limit:${chatId}:${Math.floor(Date.now() / 900_000)}`,
        });
        return NextResponse.json({ ok: true });
      }

      const token = await (prisma as any).adminLinkToken.findFirst({
        where: {
          code,
          used: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!token) {
        await sendTelegramAlert({
          chatId,
          text: "❌ رمز الربط خاطئ أو انتهت صلاحيته (الكود يدوم 5 دقائق فقط). يرجى توليد رمز جديد من لوحة التحكم.",
          idempotencyKey: `link_invalid_code:${chatId}:${Date.now()}`,
        });
        return NextResponse.json({ ok: true });
      }

      try {
        let oldChatId: string | null = null;

        if (token.scope === "GLOBAL") {
          const existingSetting = await prisma.setting.findUnique({ where: { key: "ADMIN_TELEGRAM_CHAT_ID" } });
          oldChatId = existingSetting?.value || process.env.ADMIN_CHAT_ID || null;
        } else if (token.tenantId) {
          const existingTenant = await prisma.tenant.findUnique({ where: { id: token.tenantId } });
          oldChatId = existingTenant?.telegramChatId || null;
        }

        await (prisma as any).$transaction(async (tx: any) => {
          const claimed = await tx.adminLinkToken.updateMany({
            where: { id: token.id, used: false, expiresAt: { gt: new Date() } },
            data: { used: true },
          });

          if (claimed.count !== 1) {
            throw new Error("TOKEN_ALREADY_CLAIMED");
          }

          if (token.scope === "GLOBAL") {
            await tx.setting.upsert({
              where: { key: "ADMIN_TELEGRAM_CHAT_ID" },
              update: { value: chatId },
              create: { key: "ADMIN_TELEGRAM_CHAT_ID", value: chatId },
            });
          } else if (token.tenantId) {
            await tx.tenant.update({
              where: { id: token.tenantId },
              data: { telegramChatId: chatId },
            });
          }

          await tx.adminLinkAudit.create({
            data: {
              scope: token.scope,
              tenantId: token.tenantId,
              oldChatId,
              newChatId: chatId,
            },
          });
        });

        const targetLabel = token.scope === "GLOBAL" ? "أدمن المنصة الرئيسي" : "أدمن الشركة";
        await sendTelegramAlert({
          chatId,
          text: `✅ *تم ربط حسابك كـ ${targetLabel} بنجاح!*\n\nستصلك إشعارات وتنبيهات النظام والموافقات مباشرة هنا على هذا الحساب.`,
          idempotencyKey: `link_success:${chatId}:${Date.now()}`,
        });
      } catch (err: any) {
        if (err?.message === "TOKEN_ALREADY_CLAIMED") {
          await sendTelegramAlert({
            chatId,
            text: "⚠️ تم استخدام رمز الربط هذا مسبقاً من جلسة أخرى.",
            idempotencyKey: `link_claimed:${chatId}:${Date.now()}`,
          });
        } else {
          console.error("[telegram-webhook] Error claiming admin token:", err);
          await sendTelegramAlert({
            chatId,
            text: "❌ حدث خطأ أثناء ربط الحساب، يرجى المحاولة مرة أخرى.",
            idempotencyKey: `link_error:${chatId}:${Date.now()}`,
          });
        }
      }

      return NextResponse.json({ ok: true });
    }

    // Voice Note Handling (Transcription via Groq Whisper)
    if (message.voice) {
      try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const [alertRes, fileRes] = await Promise.all([
          sendTelegramAlert({
            chatId,
            text: "جاري الاستماع للرسالة الصوتية... ⏳",
            idempotencyKey: `voice_ack:${chatId}:${message.message_id}`,
          }),
          fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${message.voice.file_id}`)
        ]);
        const fileData = await fileRes.json();
        
        if (fileData.ok && fileData.result.file_path) {
          const filePath = fileData.result.file_path;
          const audioRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
          const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
          
          const voiceTenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: chatId } });
          const rawText = await transcribeVoiceNote(audioBuffer, voiceTenant?.id);
          console.log(`\n[Voice Webhook] Raw STT: "${rawText}"`);
          text = await correctTranscriptWithLLM(rawText);
          console.log(`[Voice Webhook] Corrected STT: "${text}"\n`);
        }
      } catch (err: any) {
        console.error("Voice Note Error:", err);
        await sendTelegramAlert({
          chatId,
          text: "❌ عذراً، حدث خطأ أثناء تفريغ الرسالة الصوتية.",
          idempotencyKey: `voice_err:${chatId}:${message.message_id}`,
        });
        return NextResponse.json({ ok: true });
      }
    }

    // Image/Document Handling (Vision via Gemini)
    if (message.photo && message.photo.length > 0) {
      try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const photo = message.photo[message.photo.length - 1]; // Highest resolution
        
        const [alertRes, fileRes] = await Promise.all([
          sendTelegramAlert({
            chatId,
            text: "جاري قراءة الفاتورة/الصورة... ⏳",
            idempotencyKey: `photo_ack:${chatId}:${message.message_id}`,
          }),
          fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${photo.file_id}`)
        ]);
        const fileData = await fileRes.json();
        
        if (fileData.ok && fileData.result.file_path) {
          const filePath = fileData.result.file_path;
          const imageRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
          const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
          
          const extractedJsonStr = await processImage(
            imageBuffer, 
            "image/jpeg", // Telegram photo[] is always JPEG-compressed
            "استخرج بيانات الفاتورة بدقة (المنتج، السعر، التاريخ، الكمية). أرجع النتيجة بصيغة JSON."
          );
          
          console.log(`\n[Vision Webhook] Extracted JSON: ${extractedJsonStr}\n`);
          text = `[بيانات مستخرجة من صورة]:\n${extractedJsonStr}\n\nيرجى تأكيد تسجيل هذه البيانات أو إلغائها.`;
        }
      } catch (err: any) {
        console.error("Image Processing Error:", err);
        await sendTelegramAlert({
          chatId,
          text: "❌ عذراً، حدث خطأ أثناء قراءة الصورة.",
          idempotencyKey: `photo_err:${chatId}:${message.message_id}`,
        });
        return NextResponse.json({ ok: true });
      }
    }

    // Document Image Handling (PNG/WEBP invoices sent as files)
    if (message.document && message.document.mime_type) {
      const supportedDocMimes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
      if (supportedDocMimes.includes(message.document.mime_type)) {
        try {
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          const [alertRes, fileRes] = await Promise.all([
            sendTelegramAlert({
              chatId,
              text: "جاري قراءة الفاتورة... ⏳",
              idempotencyKey: `doc_ack:${chatId}:${message.message_id}`,
            }),
            fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${message.document.file_id}`)
          ]);
          const fileData = await fileRes.json();

          if (fileData.ok && fileData.result.file_path) {
            const filePath = fileData.result.file_path;
            const docRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
            const docBuffer = Buffer.from(await docRes.arrayBuffer());

            const extractedJsonStr = await processImage(
              docBuffer,
              message.document.mime_type as string,
              "استخرج بيانات الفاتورة بدقة (المنتج، السعر، التاريخ، الكمية). أرجع النتيجة بصيغة JSON."
            );

            console.log(`\n[Vision Doc Webhook] Extracted JSON: ${extractedJsonStr}\n`);
            text = `[بيانات مستخرجة من مستند]:\n${extractedJsonStr}\n\nيرجى تأكيد تسجيل هذه البيانات أو إلغائها.`;
          }
        } catch (err: any) {
          console.error("Document Image Processing Error:", err);
          await sendTelegramAlert({
            chatId,
            text: "❌ عذراً، حدث خطأ أثناء قراءة المستند.",
            idempotencyKey: `doc_err:${chatId}:${message.message_id}`,
          });
          return NextResponse.json({ ok: true });
        }
      }
    }

    // Onboarding Input Interceptor
    let tenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: chatId } });

    if (tenant && tenant.state !== "active" && tenant.state !== "pending_agreement") {
      if (!text) {
        await sendTelegramAlert({
          chatId,
          text: "⚠️ من فضلك اكتب النص المطلوب للاستمرار في الإعداد.",
          idempotencyKey: `onboarding:validation:${chatId}:${message.message_id}`,
        });
        return NextResponse.json({ ok: true });
      }

      if (tenant.state === "onboarding_merchant_name") {
        const cleanName = text.replace(/^(مستر|أستاذ|استاذ)\s+/, '').trim();
        tenant = await (prisma as any).tenant.update({
          where: { id: tenant.id },
          data: { merchantName: cleanName, state: "onboarding_name" },
        });
        await sendTelegramAlert({
          chatId,
          text: `أهلاً بيك يا مستر ${cleanName}! 😊 قولي اسم بيزنسك ايه؟`,
          idempotencyKey: `onboarding:name_prompt:${chatId}:${message.message_id}`,
        });
        return NextResponse.json({ ok: true });
      }

      if (tenant.state === "onboarding_name") {
        tenant = await (prisma as any).tenant.update({
          where: { id: tenant.id },
          data: { name: text, state: "onboarding_description" },
        });
        await sendTelegramAlert({
          chatId,
          text: `جميل جداً يا فندم! احكيلي بسرعة عن بيزنسك *${text}* بتعمل ايه (نوع الخدمة/المنتجات)؟`,
          idempotencyKey: `onboarding:desc_prompt:${chatId}:${message.message_id}`,
        });
        return NextResponse.json({ ok: true });
      }

      if (tenant.state === "onboarding_description") {
        await (prisma as any).knowledgeItem.create({
          data: {
            tenantId: tenant.id,
            question: "وصف البيزنس العام والخدمات",
            answer: text,
            keywords: "[\"وصف\", \"خدمات\", \"عن البيزنس\"]",
          },
        });

        tenant = await (prisma as any).tenant.update({
          where: { id: tenant.id },
          data: { state: "onboarding_business_type" },
        });

        await sendTelegramAlert({
          chatId,
          text: "تمام! اختار نوع النشاط/البيزنس بتاعك من الأزرار المتاحة:",
          idempotencyKey: `onboarding:type_prompt:${chatId}:${message.message_id}`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: "🍔 مطعم/كافيه", callback_data: "type:restaurant" },
                { text: "🏥 عيادة/مركز طبي", callback_data: "type:clinic" },
              ],
              [
                { text: "💇 صالون/تجميل", callback_data: "type:beauty" },
                { text: "🛍️ متجر/محل", callback_data: "type:store" },
              ],
              [
                { text: "🔧 خدمات عامة", callback_data: "type:services" },
                { text: "✏️ غير ذلك", callback_data: "type:custom" },
              ],
            ],
          },
        });
        return NextResponse.json({ ok: true });
      }

      if (tenant.state === "onboarding_type_custom") {
        tenant = await (prisma as any).tenant.update({
          where: { id: tenant.id },
          data: { businessType: text, state: "onboarding_working_days" },
        });
        await sendTelegramAlert({
          chatId,
          text: `تمام (${text})! اختار أيام العمل في الأسبوع:`,
          idempotencyKey: `type:custom_saved:${chatId}:${message.message_id}`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: "📅 كل يوم", callback_data: "days:all_week" },
                { text: "📅 السبت - الخميس", callback_data: "days:sat_thu" },
              ],
              [
                { text: "📅 الاثنين - السبت", callback_data: "days:mon_sat" },
                { text: "✏️ تحديد مخصص", callback_data: "days:custom" },
              ],
            ],
          },
        });
        return NextResponse.json({ ok: true });
      }

      if (tenant.state === "onboarding_days_custom") {
        tenant = await (prisma as any).tenant.update({
          where: { id: tenant.id },
          data: { workingHours: text, state: "onboarding_working_hours" },
        });
        await sendTelegramAlert({
          chatId,
          text: `تمام (${text})! اختار نطاق ساعات العمل اليومية:`,
          idempotencyKey: `days:custom_saved:${chatId}:${message.message_id}`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: "⏰ 9ص - 5م", callback_data: "hours:9_5" },
                { text: "⏰ 10ص - 10م", callback_data: "hours:10_10" },
              ],
              [
                { text: "⏰ 12م - 12ص", callback_data: "hours:12_12" },
                { text: "⏰ 24 ساعة", callback_data: "hours:24_7" },
              ],
              [{ text: "✏️ وقت مخصص", callback_data: "hours:custom" }],
            ],
          },
        });
        return NextResponse.json({ ok: true });
      }

      if (tenant.state === "onboarding_hours_custom") {
        const fullHoursStr = `${tenant.workingHours || "مخصص"}: ${text}`;
        tenant = await (prisma as any).tenant.update({
          where: { id: tenant.id },
          data: { workingHours: fullHoursStr, state: "pending_approval" },
        });

        await sendTelegramAlert({
          chatId,
          text: `📝 *تم تسجيل بيانات نشاطك بنجاح!*\n\n🏢 *الشركة:* ${tenant.name}\n💼 *النشاط:* ${tenant.businessType || "عام"}\n⏰ *المواعيد:* ${fullHoursStr}\n\n⏳ *طلبك الآن قيد مراجعة الإدارة.* سنرسل لك إشعاراً فور التفعيل والتأكيد.`,
          idempotencyKey: `hours:custom_saved:${chatId}:${message.message_id}`,
        });

        const adminChatId = await getAdminChatId();
        if (adminChatId) {
          await sendTelegramAlert({
            chatId: adminChatId,
            text: `📋 *طلب تفعيل شركة جديد عبر البوت!*\n\n🏢 *الشركة:* ${tenant.name}\n💼 *النشاط:* ${tenant.businessType || "عام"}\n⏰ *المواعيد:* ${fullHoursStr}\n🆔 *Chat ID:* \`${chatId}\``,
            idempotencyKey: `admin_approval_tenant_custom:${tenant.id}`,
            replyMarkup: {
              inline_keyboard: [
                [
                  { text: "✅ موافقة وتفعيل", callback_data: `approve_tenant:${tenant.id}` },
                  { text: "❌ رفض الطلب", callback_data: `reject_tenant:${tenant.id}` },
                ],
              ],
            },
          });
        }
        return NextResponse.json({ ok: true });
      }
    }

    // Trigger native Telegram menu commands setup
    void setTelegramBotCommands();

    if (text === "/start") {
      if (tenant) {
        if (tenant.state === "pending_agreement") {
          await sendTelegramAlert({
            chatId,
            text: "أهلاً بيك! أنا هساعدك تجرب المساعد الذكي بتاعك. موافق تبدأ؟",
            idempotencyKey: `start:agreement:${chatId}:${message.message_id}`,
            replyMarkup: {
              inline_keyboard: [[{ text: "✅ موافق", callback_data: "agree_terms" }]],
            },
          });
          return NextResponse.json({ ok: true });
        }

        const merchantGreeting = tenant.merchantName ? `مستر ${tenant.merchantName.replace(/^(مستر|أستاذ|استاذ)\s+/, '').trim()}` : `أستاذ/ة ${tenant.name}`;
        await sendTelegramAlert({
          chatId,
          text: `👋 *أهلاً بك مجدداً ${merchantGreeting}!*\n\nحساب شركتك مفعل وجاهز لخدمتك.\n🏢 *اسم الشركة:* ${tenant.name}\n🏢 *نوع النشاط:* ${tenant.businessType || "غير محدد"}\n⏰ *مواعيد العمل:* ${tenant.workingHours || "غير محددة"}\n\nيمكنك استخدام الأوامر السريعة بالأسفل أو إرسال أي سؤال مباشرة:`,
          idempotencyKey: `start:tenant:${chatId}:${message.message_id}`,
          replyMarkup: {
            inline_keyboard: [
              [{ text: "📱 القائمة المباشرة (تسجيل مبيعات/خدمات)", callback_data: "cmd_menu" }],
              [{ text: "🎤 اتصال صوتي مباشر", web_app: { url: `https://ai.casper-erp.com/telegram-voice?tenantId=${tenant.id}` } }],
              [{ text: "⚙️ تعديل الإعدادات والنشاط", callback_data: "type:custom" }],
              [
                { text: "📅 المواعيد المسجلة", callback_data: "cmd_appointments" },
                { text: "💬 التحدث مع موظف دعم", callback_data: "cmd_human" },
              ],
            ],
          },
        });
        return NextResponse.json({ ok: true });
      }

      // Create new tenant in pending_agreement state
      tenant = await (prisma as any).tenant.create({
        data: {
          name: message.from?.first_name ? `${message.from.first_name} ${message.from.last_name || ""}`.trim() : "بيزنس جديد",
          telegramChatId: chatId,
          state: "pending_agreement",
        },
      });

      await sendTelegramAlert({
        chatId,
        text: "أهلاً بيك! أنا هساعدك تجرب المساعد الذكي بتاعك. موافق تبدأ؟",
        idempotencyKey: `start:new_tenant:${chatId}:${message.message_id}`,
        replyMarkup: {
          inline_keyboard: [[{ text: "✅ موافق", callback_data: "agree_terms" }]],
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (text === "/menu") {
      await sendFallbackMainMenu(chatId);
    } else if (text === "/appointments") {
      const textApptTenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: chatId } });
      const appointments = await prisma.appointment.findMany({
        where: textApptTenant ? { tenantId: textApptTenant.id } : { tenantId: "__NONE__" },
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
    } else if (text === "/settings") {
      const currentTenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: chatId } });
      await sendTelegramAlert({
        chatId,
        text: `⚙️ *إعدادات حسابك (${currentTenant?.name || "الشركة"}):*\n\n🏢 *نوع النشاط الحالي:* ${currentTenant?.businessType || "غير محدد"}\n⏰ *مواعيد العمل الحالية:* ${currentTenant?.workingHours || "غير محددة"}\n\nتفضل باختيار التعديل المطلوبة من الأزرار:`,
        idempotencyKey: `settings:${chatId}:${message.message_id}`,
        replyMarkup: {
          inline_keyboard: [
            [{ text: "✏️ تعديل نوع النشاط/البيزنس", callback_data: "type:custom" }],
            [{ text: "✏️ تعديل مواعيد العمل", callback_data: "days:custom" }],
          ],
        },
      });
    } else if (text === "/human" || text === "/help" || text === "مساعدة" || text === "تحدث مع موظف") {
      const currentTenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: chatId } });
      const customerName = message.from?.first_name 
        ? `${message.from.first_name} ${message.from.last_name || ""}`.trim() 
        : currentTenant?.name || "عميل";

      // 1. Notify Customer
      await sendTelegramAlert({
        chatId,
        text: "⏳ *تم توجيه طلبك لأحد ممثلي الدعم الفني*، وسيقوم بالرد عليك في أقرب وقت ممكن.",
        idempotencyKey: `escalate:customer:${chatId}:${message.message_id}`,
      });

      // 2. Alert Admin
      const adminChatId = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
      if (adminChatId) {
        await sendTelegramAlert({
          chatId: adminChatId,
          text: `🚨 *طلب تصعيد دعم فني جديد!*\n\n👤 *العميل:* ${customerName}\n🆔 *Chat ID:* \`${chatId}\`\n💬 *الشركة:* ${currentTenant?.name || "غير مسجل"}`,
          idempotencyKey: `escalate:admin_notify:${chatId}:${message.message_id}`,
          replyMarkup: {
            inline_keyboard: [
              [{ text: "✅ إغلاق وسؤال رأي العميل", callback_data: `resolve:${chatId}` }],
            ],
          },
        });
      }
    } else {
      const tenant = await (prisma as any).tenant.findUnique({ where: { telegramChatId: chatId } });

      if (!tenant) {
        await sendTelegramAlert({
          chatId,
          text: "⚠️ *تنبيه:* حسابك غير مسجل أو تم حذفه. يرجى إرسال `/start` لبدء التسجيل وتفعيل الحساب من جديد.",
          idempotencyKey: `unregistered_notice:${chatId}:${Math.floor(Date.now() / 60000)}`,
        });
        return NextResponse.json({ ok: true });
      }

      if (tenant.state !== "active") {
        await sendTelegramAlert({
          chatId,
          text: "⚠️ *تنبيه:* حسابك غير نشط حالياً (قيد المراجعة أو موقوف). يرجى الانتظار للتفعيل من لوحة التحكم.",
          idempotencyKey: `inactive_notice:${chatId}:${Math.floor(Date.now() / 60000)}`,
        });
        return NextResponse.json({ ok: true });
      }

      const tenantId = tenant.id;

      // 1. Check if active Fallback Flow state machine is in progress
      if (tenantId) {
        const state = await getActiveConversationState(chatId, tenantId);
        if (state && state.currentFlow) {
          const handled = await processFallbackInput(chatId, tenantId, text, state);
          if (handled) {
            return NextResponse.json({ ok: true });
          }
        }
      }

      // 2. Direct Text Message Routing to LLM Pipeline
      const llmResult = await processTelegramMessageWithLLM(
        text,
        tenant?.id,
        tenant?.name,
        tenant?.businessType,
        tenant?.workingHours,
        chatId,
        message.message_id,
        tenant?.merchantName
      );

      if (llmResult.status === "all_providers_exhausted") {
        await sendFallbackMainMenu(chatId);

        const adminChatId = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
        if (adminChatId) {
          await sendTelegramAlert({
            chatId: adminChatId,
            text: `⚠️ *تنبيه طوارئ:* جميع مفاتيح والخدمات الخاصة بالذكاء الاصطناعي مستنفدة/متوقفة حالياً. تم تحويل التاجر (${tenant?.name || chatId}) إلى نظام القوائم الطارئة بنجاح.`,
            idempotencyKey: `emergency_alert:${chatId}:${Date.now()}`,
          });
        }
        return NextResponse.json({ ok: true });
      }

      const replyText = llmResult.text;

      if (replyText) {
        await sendTelegramAlert({
          chatId,
          text: replyText,
          idempotencyKey: `llm_reply:${chatId}:${message.message_id}`,
        });
      }

      // Audit Trail Logging in Conversation
      await prisma.conversation.create({
        data: {
          channel: "telegram",
          transcript: `User (${chatId}): ${text}\nBot: ${replyText}`,
          summary: `Telegram chat with ${tenant?.name || chatId}`
        }
      }).catch((e) => console.error("[Telegram Conversation Log Error]", e));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Telegram Webhook Handler Error]", err);
    return NextResponse.json({ ok: true });
  }
}

// ── Telegram Business Routing Helpers ──

async function handleCustomerMessage(params: {
  tenant: any;
  customer: any;
  text?: string;
  voice?: any;
  sendVia: { businessConnectionId: string; chatId: number };
}) {
  const { tenant, customer, text, voice, sendVia } = params;
  
  if (voice) {
    // Handling voice notes in business connection is out of scope for the current snippet,
    // but we can log it or fall back to a text reply.
    console.log("Customer sent a voice note via Business Connection");
  }

  const messageText = (text || "").trim();
  if (messageText) {
    // Process via LLM
    const llmResult = await processTelegramMessageWithLLM(
      messageText,
      tenant.id,
      tenant.name,
      tenant.businessType,
      tenant.workingHours,
      String(sendVia.chatId),
      0, // No direct message id available easily here, passing 0
      tenant.merchantName
    );

    const replyText = (llmResult as any)?.text;
    
    if (replyText) {
      // Send response via the business connection on behalf of the owner
      await sendAsBusinessOwner(sendVia.chatId, sendVia.businessConnectionId, replyText);
    }
  }
}

async function sendAsBusinessOwner(chatId: number, connectionId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is missing");
    return;
  }
  
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      business_connection_id: connectionId,
      text,
    }),
  });
  
  if (!res.ok) {
    console.error("Failed to send message as business owner:", await res.text());
  }
}

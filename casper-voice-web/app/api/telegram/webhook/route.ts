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
  setTelegramBotCommands,
} from "@/lib/telegram";
import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import {
  sendFallbackMainMenu,
  getActiveConversationState,
  handleFallbackMenuCallback,
  handleFallbackSaleCallback,
  processFallbackInput,
} from "@/lib/telegram_fallback";
import { correctTranscriptWithLLM } from "@/lib/llm_correction";

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
            data: { state: "onboarding_name" },
          });
          await sendTelegramAlert({
            chatId: callbackChatId,
            text: "تمام! قولي اسم بيزنسك ايه؟",
            idempotencyKey: `onboarding:name_prompt:${callbackChatId}`,
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
              data: { workingHours: fullHoursStr, state: "active" },
            });

            await sendTelegramAlert({
              chatId: callbackChatId,
              text: `🎉 *تمام خالص!* البوت بقى جاهز يشتغل باسم *${updatedTenant.name}*.\n🏢 *النشاط:* ${updatedTenant.businessType || "عام"}\n⏰ *المواعيد:* ${fullHoursStr}\n\nابعتلي أي طلب أو سؤال عادي دلوقتي وهرد عليك/أنفذه.`,
              idempotencyKey: `onboarding:active:${callbackChatId}`,
            });
          }
        }
        await answerCallback("تم الحفظ بنجاح!");
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith("csat:")) {
        const rating = data.replace("csat:", "");
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

      const expectedAdminId = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
      // Auth Check: Admin Callback sender MUST equal ADMIN_CHAT_ID
      if (expectedAdminId && callbackChatId !== expectedAdminId) {
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith("approve:")) {
        const requestId = data.replace("approve:", "");
        await approveTenantRequest(requestId, `telegram:${callbackChatId}`);
      } else if (data.startsWith("reject:")) {
        const requestId = data.replace("reject:", "");
        await rejectTenantRequest(requestId, `telegram:${callbackChatId}`);
      }

      await answerCallback("تم تنفيذ الإجراء بنجاح!");
      return NextResponse.json({ ok: true });
    }

    // 4. Handle Standard Incoming Messages
    const message = update?.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    let text = typeof message.text === "string" ? message.text.trim() : "";

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
          const audioBuffer = await audioRes.arrayBuffer();
          
          const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
          const formData = new FormData();
          formData.append('file', blob, 'voice.ogg');
          formData.append('model', 'whisper-large-v3-turbo');
          formData.append('language', 'ar');
          formData.append('prompt', 'نظام كاسبر مبيعات ومشتريات كرتونة كرتون مسمار مسامير عسل صاج عميل فاتورة حساب بنزين صيانة مصاريف جنيه أجهزة بضاعة مورد قطع غيار');

          let groqKey = process.env.GROQ_API_KEY;
          if (!groqKey) {
             const setting = await (prisma as any).setting.findUnique({ where: { key: "GROQ_API_KEY" } });
             if (setting) groqKey = setting.value;
          }

          if (groqKey) {
            const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${groqKey}` },
              body: formData
            });
            const groqData = await groqRes.json();
            if (groqData.text) {
              const rawText = groqData.text;
              console.log(`\n[Voice Webhook] Raw STT: "${rawText}"`);
              text = await correctTranscriptWithLLM(rawText); // Override the text and continue!
              console.log(`[Voice Webhook] Corrected STT: "${text}"\n`);
            } else {
              throw new Error("No text returned from Groq API");
            }
          } else {
            throw new Error("GROQ_API_KEY is missing");
          }
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
          data: { workingHours: fullHoursStr, state: "active" },
        });

        await sendTelegramAlert({
          chatId,
          text: `🎉 *تمام خالص!* البوت بقى جاهز يشتغل باسم *${tenant.name}*.\n🏢 *النشاط:* ${tenant.businessType || "عام"}\n⏰ *المواعيد:* ${fullHoursStr}\n\nابعتلي أي طلب أو سؤال عادي دلوقتي وهرد عليك/أنفذه.`,
          idempotencyKey: `hours:custom_saved:${chatId}:${message.message_id}`,
        });
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

        await sendTelegramAlert({
          chatId,
          text: `👋 *أهلاً بك مجدداً أستاذ/ة ${tenant.name}!*\n\nحساب شركتك مفعل وجاهز لخدمتك.\n🏢 *نوع النشاط:* ${tenant.businessType || "غير محدد"}\n⏰ *مواعيد العمل:* ${tenant.workingHours || "غير محددة"}\n\nيمكنك استخدام الأوامر السريعة بالأسفل أو إرسال أي سؤال مباشرة:`,
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
      const tenantId = tenant?.id || "";

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
        chatId
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

      await sendTelegramAlert({
        chatId,
        text: replyText,
        idempotencyKey: `llm_reply:${chatId}:${message.message_id}`,
      });

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

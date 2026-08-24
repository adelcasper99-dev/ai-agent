import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const now = new Date();

    // Fetch all pending reminders due right now or past due
    const dueReminders = await (prisma as any).reminder.findMany({
      where: {
        status: "pending",
        remindAt: { lte: now }
      },
      include: {
        tenant: true
      },
      take: 25
    });

    let sentCount = 0;

    for (const rem of dueReminders) {
      // Atomic status lock to prevent duplicate sends across concurrent workers
      const lockRes = await (prisma as any).reminder.updateMany({
        where: { id: rem.id, status: "pending" },
        data: { status: "sending" }
      });

      if (lockRes.count === 0) continue;

      const chatId = rem.telegramChatId || rem.tenant?.telegramChatId;
      if (chatId) {
        const timeStr = rem.remindAt.toLocaleTimeString("ar-EG", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        });

        const alertText = `🔔 *تذكير مستحق الآن:*\n━━━━━━━━━━━━━━━━\n📌 *${rem.title}*\n${rem.customerName ? `👤 العميل: *${rem.customerName}*\n` : ''}⏰ الوقت: ${timeStr}\n━━━━━━━━━━━━━━━━`;

        const inlineButtons = [
          [
            { text: "✅ تم الإنجاز", callback_data: `done_rem_${rem.id}` },
            { text: "⏰ تأجيل ساعة", callback_data: `snooze_rem_${rem.id}_60` }
          ]
        ];

        try {
          await sendTelegramAlert({
            chatId,
            text: alertText,
            idempotencyKey: `rem_push_${rem.id}_${now.getTime()}`,
            replyMarkup: { inline_keyboard: inlineButtons }
          });
          sentCount++;
        } catch (pushErr) {
          console.error(`[Reminder Dispatcher Push Error] remId=${rem.id}:`, pushErr);
        }
      }

      await (prisma as any).reminder.update({
        where: { id: rem.id },
        data: { status: "sent" }
      });
    }

    return NextResponse.json({
      success: true,
      processed: dueReminders.length,
      sent: sentCount,
      timestamp: now.toISOString()
    });
  } catch (err: any) {
    console.error("[Reminder Dispatcher Error]:", err);
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

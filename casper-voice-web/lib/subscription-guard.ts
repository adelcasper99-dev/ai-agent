import { prisma } from "@/lib/prisma";
import { sendTelegramAlert } from "@/lib/telegram";

export async function enforceSubscriptionExpiry(): Promise<void> {
  try {
    const now = new Date();
    const expiredTenants = await (prisma as any).tenant.findMany({
      where: {
        expiresAt: { lt: now },
        state: { in: ["active", "trial"] },
      },
    });

    for (const tenant of expiredTenants) {
      await (prisma as any).tenant.update({
        where: { id: tenant.id },
        data: { state: "past_due_silent" },
      });

      if (tenant.telegramChatId) {
        await sendTelegramAlert({
          chatId: tenant.telegramChatId,
          text: `⚠️ *تنبيه انتهاء الاشتراك*\n\nانتهت مدة اشتراك شركتك (${tenant.name}). يرجى تجديد الاشتراك للاستمرار في استخدام الخدمة.`,
          idempotencyKey: `expiry_notice:${tenant.id}:${now.toISOString().slice(0, 10)}`,
        });
      }
    }
  } catch (err) {
    console.error("[enforceSubscriptionExpiry Error]:", err);
  }
}

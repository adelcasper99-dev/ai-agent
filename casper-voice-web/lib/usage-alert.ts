import { prisma } from "@/lib/prisma";
import { sendTelegramAlert } from "@/lib/telegram";

const DAILY_TOKEN_ALERT_THRESHOLD = 50_000;

export async function checkAndAlertTokenUsage(tenantId: string, provider: string = "gemini"): Promise<void> {
  try {
    const dateStr = new Date().toISOString().slice(0, 10);
    const agg = await (prisma as any).tokenUsage.aggregate({
      where: { tenantId, dateStr },
      _sum: { totalTokens: true },
    });
    const total: number = agg._sum?.totalTokens ?? 0;
    if (total >= DAILY_TOKEN_ALERT_THRESHOLD) {
      const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
      const adminChatId = process.env.ADMIN_CHAT_ID;
      if (adminChatId && tenant) {
        await sendTelegramAlert({
          chatId: adminChatId,
          text: `⚠️ *تنبيه استهلاك مرتفع!*\n\n🏢 *الشركة:* ${tenant.name}\n📊 *اليوم:* ${total.toLocaleString()} توكن\n🤖 *المزود:* ${provider.toUpperCase()}`,
          idempotencyKey: `usage_alert:${tenantId}:${dateStr}`,
        });
      }
    }
  } catch (err) {
    console.error("[checkAndAlertTokenUsage Error]:", err);
  }
}

import { prisma } from "@/lib/prisma";
import { sendTelegramAlert, getAdminChatId } from "@/lib/telegram";

export const DAILY_TOKEN_ALERT_THRESHOLD = 50_000;
export const TOKEN_ALERT_STEP = 50_000;

// Daily in-memory alert milestone cache: key -> highest tier alerted today (prevents spam on every message)
export const sentDailyUsageMilestones = new Map<string, number>();

export function getMilestoneKey(tenantId: string, dateStr: string): string {
  return `${tenantId}:${dateStr}`;
}

export function formatTenantName(rawName: string | null | undefined): string {
  if (!rawName || !rawName.trim()) return "شركة غير محددة";
  const cleaned = rawName.replace(/[\r\n]+/g, " ").trim();
  if (cleaned.length <= 50) return cleaned;
  return `${cleaned.slice(0, 47)}...`;
}

export async function checkAndAlertTokenUsage(tenantId: string, provider: string = "gemini"): Promise<boolean> {
  try {
    if (tenantId === "guardrails_tenant_id") return false;
    const dateStr = new Date().toISOString().slice(0, 10);
    const milestoneKey = getMilestoneKey(tenantId, dateStr);

    const agg = await (prisma as any).tokenUsage.aggregate({
      where: { tenantId, dateStr },
      _sum: { totalTokens: true },
    });
    const total: number = agg._sum?.totalTokens ?? 0;

    if (total < DAILY_TOKEN_ALERT_THRESHOLD) {
      return false;
    }

    // Calculate current milestone tier (e.g. 50k, 100k, 150k...)
    const currentTier = Math.floor(total / TOKEN_ALERT_STEP) * TOKEN_ALERT_STEP;
    const lastAlertedTier = sentDailyUsageMilestones.get(milestoneKey) ?? 0;

    // Only alert if we crossed into a new higher milestone tier today
    if (currentTier <= lastAlertedTier) {
      return false;
    }

    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    const adminChatId = await getAdminChatId();

    if (adminChatId && tenant) {
      const formattedName = formatTenantName(tenant.name);
      const res = await sendTelegramAlert({
        chatId: adminChatId,
        text: `⚠️ *تنبيه استهلاك توكنز مرتفع!*\n\n🏢 *الشركة:* ${formattedName}\n📊 *اليوم:* ${total.toLocaleString()} توكن (المستوى: ${currentTier.toLocaleString()})\n🤖 *المزود:* ${provider.toUpperCase()}`,
        idempotencyKey: `usage_alert:${tenantId}:${dateStr}:${currentTier}`,
      });

      if (res.success) {
        sentDailyUsageMilestones.set(milestoneKey, currentTier);
        return true;
      }
    }
  } catch (err) {
    console.error("[checkAndAlertTokenUsage Error]:", err);
  }
  return false;
}

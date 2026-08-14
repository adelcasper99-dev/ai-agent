/**
 * tenant-quota.ts — Tenant LLM Rate Limiting & Daily Quota Management Engine
 */

import { prisma } from './prisma';
import { sendTelegramAlert } from './telegram';

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  usage: number;
  usagePct: number;
}

/**
 * Returns today's date string formatted in Africa/Cairo timezone (YYYY-MM-DD)
 */
export function getCairoTodayDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Checks and increments Tenant LLM daily usage atomically.
 * Automatically resets quota at Midnight Cairo Time.
 * Triggers 80% warning and 100% exhaustion alerts idempotently.
 */
export async function checkAndIncrementTenantLlmQuota(tenantId: string): Promise<QuotaCheckResult> {
  const tenant = await (prisma as any).tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    return { allowed: true, remaining: 200, limit: 200, usage: 0, usagePct: 0 };
  }

  const limit = tenant.dailyLlmLimit > 0 ? tenant.dailyLlmLimit : 200;
  const todayStr = getCairoTodayDateString();
  const lastResetStr = getCairoTodayDateString(tenant.lastLlmReset || new Date(0));

  let currentUsage = tenant.dailyLlmUsage || 0;
  let alert80Sent = tenant.alert80SentDate;
  let alert100Sent = tenant.alert100SentDate;

  // Perform Daily Reset if new day in Cairo Time
  if (lastResetStr !== todayStr) {
    currentUsage = 0;
    alert80Sent = null;
    alert100Sent = null;

    await (prisma as any).tenant.update({
      where: { id: tenantId },
      data: {
        dailyLlmUsage: 0,
        lastLlmReset: new Date(),
        alert80SentDate: null,
        alert100SentDate: null,
      },
    });
  }

  // If already at or exceeding limit
  if (currentUsage >= limit) {
    const usagePct = Math.min(100, Math.round((currentUsage / limit) * 100));

    // Send 100% Exhaustion Alert if not sent today
    if (alert100Sent !== todayStr && tenant.telegramChatId) {
      (prisma as any).tenant.update({
        where: { id: tenantId },
        data: { alert100SentDate: todayStr },
      }).catch((e: any) => console.error('[Tenant Quota] Update alert100 date error:', e));

      // 1. Notify Merchant
      sendTelegramAlert({
        chatId: tenant.telegramChatId,
        text: `❌ *تنبيه استهلاك الكوتا:* تم الوصول للحد الأقصى اليومي لاستخدام الذكاء الاصطناعي (${currentUsage}/${limit} طلب).\n\nيتجدد حسابك تلقائياً الساعة 12 منتصف الليل، أو يمكنك التواصل مع الدعم لترقية باقتك.`,
        idempotencyKey: `llm_quota_100:${tenantId}:${todayStr}`,
        replyMarkup: {
          inline_keyboard: [
            [{ text: '📞 التواصل مع الدعم الفني', url: 'https://t.me/CasperErpSupportBot' }]
          ]
        }
      }).catch((e) => console.error('[Tenant Quota] Alert 100 error:', e));

      // 2. Notify Super Admin
      const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID || '148680198';
      sendTelegramAlert({
        chatId: adminChatId,
        text: `🚨 *إشعار للأدمن:* التاجر *${tenant.merchantName || tenant.name}* (${tenant.phoneNumber || 'بدون رقم'}) استهلك 100% من كوتا الذكاء الاصطناعي اليوم (${currentUsage}/${limit} طلب).`,
        idempotencyKey: `admin_quota_100:${tenantId}:${todayStr}`,
      }).catch((e) => console.error('[Tenant Quota] Admin alert error:', e));
    }

    return {
      allowed: false,
      remaining: 0,
      limit,
      usage: currentUsage,
      usagePct,
    };
  }

  // Increment usage atomically
  const updatedTenant = await (prisma as any).tenant.update({
    where: { id: tenantId },
    data: {
      dailyLlmUsage: { increment: 1 },
    },
  });

  const newUsage = updatedTenant.dailyLlmUsage;
  const newRemaining = Math.max(0, limit - newUsage);
  const usagePct = Math.round((newUsage / limit) * 100);

  // Check 80% Threshold
  if (usagePct >= 80 && alert80Sent !== todayStr && tenant.telegramChatId) {
    (prisma as any).tenant.update({
      where: { id: tenantId },
      data: { alert80SentDate: todayStr },
    }).catch((e: any) => console.error('[Tenant Quota] Update alert80 date error:', e));

    sendTelegramAlert({
      chatId: tenant.telegramChatId,
      text: `⚠️ *تنبيه استهلاك الكوتا:* لقد استهلكت ${usagePct}% من حدك اليومي للذكاء الاصطناعي (${newUsage}/${limit} طلب).\n\nسيتم تصفير العداد تلقائياً الساعة 12 منتصف الليل.`,
      idempotencyKey: `llm_quota_80:${tenantId}:${todayStr}`,
    }).catch((e) => console.error('[Tenant Quota] Alert 80 error:', e));
  }

  return {
    allowed: true,
    remaining: newRemaining,
    limit,
    usage: newUsage,
    usagePct,
  };
}

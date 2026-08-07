/**
 * telegram.ts — hardened Telegram alert sender & Tenant Registration engine
 */

import Decimal from 'decimal.js';
import { prisma } from './prisma';

export interface TelegramAlertPayload {
  chatId: string;
  text: string;
  idempotencyKey: string;
  replyMarkup?: any;
}

export interface SendResult {
  success: boolean;
  usedMarkdownFallback: boolean;
  attempts: number;
  error?: string;
}

// In-memory idempotency cache
const sentAlertCache = new Map<string, { timestamp: number; result: SendResult }>();
const IDEMPOTENCY_WINDOW_MS = 60_000;

// Webhook Update Deduplication Cache
const processedUpdateIds = new Map<number, number>();
export function isUpdateProcessed(updateId: number): boolean {
  const now = Date.now();
  const cached = processedUpdateIds.get(updateId);
  if (cached && now - cached < 60_000) {
    return true;
  }
  processedUpdateIds.set(updateId, now);
  return false;
}

// `/start` Rate-Limiter Cache (max 3 calls / 10 minutes per chatId)
const startRateLimiter = new Map<string, number[]>();
export function isStartRateLimited(chatId: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const timestamps = (startRateLimiter.get(chatId) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= 3) {
    return true;
  }

  timestamps.push(now);
  startRateLimiter.set(chatId, timestamps);
  return false;
}

function validateEnv() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set — cannot send Telegram alerts.');
  }
}

export async function getAdminChatId(): Promise<string | null> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'ADMIN_TELEGRAM_CHAT_ID' },
    });
    if (setting?.value && setting.value.trim()) {
      return setting.value.trim();
    }
  } catch (err) {
    console.warn('[telegram] getAdminChatId DB lookup failed, fallback to env:', err);
  }
  return process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || process.env.ADMIN_TELEGRAM_CHAT_ID || null;
}

export async function setTelegramBotCommands() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const commands = [
    { command: "start", description: "بدء التفاعل مع المساعد" },
    { command: "setup", description: "ربط حساب التليجرام بيزنس (Telegram Business Setup)" },
    { command: "menu", description: "فتح قائمة المبيعات والخدمات المباشرة" },
    { command: "settings", description: "تعديل إعدادات ونشاط الشركة والمواعيد" },
    { command: "appointments", description: "عرض المواعيد المسجلة" },
    { command: "human", description: "التحدث مع موظف الدعم الفني" },
    { command: "status", description: "حالة النظام" },
  ];

  await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  }).catch((e) => console.error("[telegram] failed to set commands", e));
}

export function isChatAllowed(chatId: string): boolean {
  const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (process.env.TELEGRAM_CHAT_ID && !allowed.includes(process.env.TELEGRAM_CHAT_ID)) {
    allowed.push(process.env.TELEGRAM_CHAT_ID);
  }

  if (allowed.length === 0) return true;
  return allowed.includes(chatId);
}

function validateChatId(chatId: string) {
  const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.length > 0 && !allowed.includes(chatId)) {
    throw new Error(
      `Rejected Telegram send: chat_id ${chatId} is not in TELEGRAM_ALLOWED_CHAT_IDS allowlist.`
    );
  }
}

async function callTelegramApi(chatId: string, text: string, useMarkdown: boolean, replyMarkup?: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const body: any = {
    chat_id: chatId,
    text,
    ...(useMarkdown ? { parse_mode: 'Markdown' } : {}),
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendTelegramAlert(payload: TelegramAlertPayload): Promise<SendResult> {
  validateEnv();
  validateChatId(payload.chatId);

  const cached = sentAlertCache.get(payload.idempotencyKey);
  if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_WINDOW_MS) {
    return cached.result;
  }

  const maxAttempts = 3;
  let lastError = '';
  let usedMarkdownFallback = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let res = await callTelegramApi(payload.chatId, payload.text, true, payload.replyMarkup);

      if (res.status === 400) {
        usedMarkdownFallback = true;
        res = await callTelegramApi(payload.chatId, payload.text, false, payload.replyMarkup);
      }

      if (res.ok) {
        const result: SendResult = { success: true, usedMarkdownFallback, attempts: attempt };
        sentAlertCache.set(payload.idempotencyKey, { timestamp: Date.now(), result });
        return result;
      }

      if (res.status === 429 || res.status >= 500) {
        lastError = `HTTP ${res.status}`;
        await sleep(attempt * 500);
        continue;
      }

      lastError = `Non-retryable HTTP ${res.status}`;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await sleep(attempt * 500);
    }
  }

  const failure: SendResult = {
    success: false,
    usedMarkdownFallback,
    attempts: maxAttempts,
    error: lastError,
  };

  console.error('[telegram] alert failed after retries', {
    chatId: payload.chatId,
    idempotencyKey: payload.idempotencyKey,
    error: lastError,
  });

  sentAlertCache.set(payload.idempotencyKey, { timestamp: Date.now(), result: failure });
  return failure;
}

export function fireAndForgetTelegramAlert(payload: TelegramAlertPayload) {
  void sendTelegramAlert(payload).catch((err) => {
    console.error('[telegram] unexpected error sending alert', err);
  });
}

/**
 * Shared Approval Service with Optimistic Lock Idempotency (`updateMany` where `status: "pending"`).
 */
export async function approveTenantRequest(requestId: string, decidedBy: string, subscriptionPlan: string = 'trial_14', expiresAt?: Date) {
  // Optimistic locking: only 1 execution will succeed in updating row from 'pending' -> 'approved'
  const updatedCount = await (prisma as any).pendingTenantRequest.updateMany({
    where: { id: requestId, status: 'pending' },
    data: {
      status: 'approved',
      decidedAt: new Date(),
      decidedBy,
      subscriptionPlan,
      expiresAt: expiresAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  if (updatedCount.count === 0) {
    // Already decided in concurrent race or previous call — return current state
    const existing = await (prisma as any).pendingTenantRequest.findUnique({ where: { id: requestId } });
    const existingTenant = existing?.telegramChatId
      ? await (prisma as any).tenant.findUnique({ where: { telegramChatId: existing.telegramChatId } })
      : null;

    return {
      alreadyDecided: true,
      request: existing,
      tenant: existingTenant,
    };
  }

  // Row updated successfully (1 row) -> Create Tenant inside single transaction
  const req = await (prisma as any).pendingTenantRequest.findUnique({ where: { id: requestId } });
  if (!req) {
    throw new Error(`Pending tenant request ${requestId} not found.`);
  }

  // Provision tenant atomically (upsert + seed KnowledgeItems)
  const { TenantProvisioner } = await import('./tenant-provisioner');
  const provisionResult = await TenantProvisioner.provision({
    name: req.customerName,
    telegramChatId: req.telegramChatId,
    phoneNumber: req.phoneNumber ?? undefined,
    pendingRequestId: undefined, // already marked approved above
  });

  let tenant = provisionResult.tenantId
    ? await (prisma as any).tenant.findUnique({ where: { id: provisionResult.tenantId } })
    : null;

  if (tenant) {
    tenant = await (prisma as any).tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionPlan,
        expiresAt: expiresAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Default 14 days
        state: 'active'
      }
    });
  }

  // Non-blocking notification to customer
  fireAndForgetTelegramAlert({
    chatId: req.telegramChatId,
    text: `🎉 *تم تفعيل حسابك بنجاح!*\nأهلاً بك أستاذ/ة *${req.customerName}* في نظام Casper ERP & POS.`,
    idempotencyKey: `approved:${req.id}`,
  });

  return {
    alreadyDecided: false,
    request: req,
    tenant,
  };
}

/**
 * Shared Rejection Service with Optimistic Lock.
 */
export async function rejectTenantRequest(requestId: string, decidedBy: string) {
  const updatedCount = await (prisma as any).pendingTenantRequest.updateMany({
    where: { id: requestId, status: 'pending' },
    data: {
      status: 'rejected',
      decidedAt: new Date(),
      decidedBy,
    },
  });

  if (updatedCount.count === 0) {
    const existing = await (prisma as any).pendingTenantRequest.findUnique({ where: { id: requestId } });
    return { alreadyDecided: true, request: existing };
  }

  const req = await (prisma as any).pendingTenantRequest.findUnique({ where: { id: requestId } });
  if (req) {
    fireAndForgetTelegramAlert({
      chatId: req.telegramChatId,
      text: `عذراً أستاذ/ة *${req.customerName}*، نعتذر عن قبول طلب التفعيل حالياً.`,
      idempotencyKey: `rejected:${req.id}`,
    });
  }

  return { alreadyDecided: false, request: req };
}

/**
 * Approves a direct Bot onboarding tenant in `pending_approval` state.
 */
export async function approveDirectTenant(tenantId: string, decidedBy: string) {
  const updatedCount = await (prisma as any).tenant.updateMany({
    where: { id: tenantId, state: 'pending_approval' },
    data: { state: 'active' },
  });

  if (updatedCount.count === 0) {
    const existing = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    return { alreadyDecided: true, tenant: existing };
  }

  const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
  if (tenant && tenant.telegramChatId) {
    fireAndForgetTelegramAlert({
      chatId: tenant.telegramChatId,
      text: `🎉 *تم تفعيل حسابك بنجاح!*\nأهلاً بك أستاذ/ة *${tenant.name}* في نظام Casper ERP & POS.\n\n📱 *الخطوة الأخيرة للربط:* قم بفتح إعدادات Telegram Business وحدد هذا البوت لاستقبال والرد على رسائل عملائك تلقائياً!`,
      idempotencyKey: `direct_approved:${tenant.id}`,
    });
  }

  return { alreadyDecided: false, tenant };
}

/**
 * Rejects a direct Bot onboarding tenant in `pending_approval` state.
 */
export async function rejectDirectTenant(tenantId: string, decidedBy: string) {
  const updatedCount = await (prisma as any).tenant.updateMany({
    where: { id: tenantId, state: 'pending_approval' },
    data: { state: 'rejected' },
  });

  if (updatedCount.count === 0) {
    const existing = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    return { alreadyDecided: true, tenant: existing };
  }

  const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
  if (tenant && tenant.telegramChatId) {
    fireAndForgetTelegramAlert({
      chatId: tenant.telegramChatId,
      text: `عذراً أستاذ/ة *${tenant.name}*، نعتذر عن تفعيل حسابك حالياً. يرجى التواصل مع الدعم الفني لمزيد من التفاصيل.`,
      idempotencyKey: `direct_rejected:${tenant.id}`,
    });
  }

  return { alreadyDecided: false, tenant };
}


import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { processTelegramMessageWithLLM } from '../lib/telegram_llm';
import { prisma, prismaSystem } from '../lib/prisma';
import { runWithTenant } from '../lib/prisma-tenant-extension';

const TENANT_ID = 'guardrails_tenant_id';
const CHAT_ID = 'guardrails_chat_id';

async function cleanupData() {
  await prismaSystem.chatMessage.deleteMany({ where: { tenantId: TENANT_ID } });
  await prismaSystem.conversationState.deleteMany({ where: { tenantId: TENANT_ID } });
  await prismaSystem.sale.deleteMany({ where: { tenantId: TENANT_ID } });
  await prismaSystem.expense.deleteMany({ where: { tenantId: TENANT_ID } });
  await prismaSystem.product.deleteMany({ where: { tenantId: TENANT_ID } });
  await prismaSystem.appointment.deleteMany({ where: { tenantId: TENANT_ID } });
}

beforeAll(async () => {
  await cleanupData();

  await prismaSystem.tenant.upsert({
    where: { id: TENANT_ID },
    update: {
      telegramChatId: CHAT_ID,
      name: 'Guardrails Test Tenant',
      state: 'active',
      subscriptionPlan: 'pro',
    },
    create: {
      id: TENANT_ID,
      telegramChatId: CHAT_ID,
      name: 'Guardrails Test Tenant',
      state: 'active',
      subscriptionPlan: 'pro',
    },
  });
});

afterAll(async () => {
  await cleanupData();
});

beforeEach(async () => {
  await cleanupData();

  await runWithTenant(TENANT_ID, async () => {
    await prisma.product.create({
      data: {
        name: 'أسمنت بورتلاندي - 50 كجم',
        unitPrice: 25.5,
        isStockItem: true,
        stockQuantity: 100,
        tenantId: TENANT_ID,
      }
    });

    await prisma.appointment.create({
      data: {
        customerName: 'احمد مكش',
        date: '2026-08-20',
        time: '03:00 مساءً',
        status: 'scheduled',
        tenantId: TENANT_ID,
      }
    });
  });
});

describe("AI Guardrails & Adversarial Prompts", () => {
  it("G1: Rejects non-existent item (سجل مسمار بـ 50)", async () => {
    const result = await processTelegramMessageWithLLM(
      "سجل مسمار بـ 50",
      TENANT_ID,
      "Test Tenant",
      "Retail",
      "9-5",
      CHAT_ID,
      Date.now()
    );
    expect(result.text || (result as any).finalReply).toMatch(/مسمار|مسامير|غير موجود|تأكد|توضيح|تفاصيل/i);
  }, 30000);

  it("G2: Rejects ambiguous item name (سجل بيع أسمنت)", async () => {
    const result = await processTelegramMessageWithLLM(
      "سجل بيع أسمنت",
      TENANT_ID,
      "Test Tenant",
      "Retail",
      "9-5",
      CHAT_ID,
      Date.now()
    );
    // Should ask for clarification since we have 'أسمنت بورتلاندي - 50 كجم'
    expect(result.text || (result as any).finalReply).toMatch(/أي نوع|تفاصيل|حدد|غير موجود|توضيح|محتاج|كام|أعرف/i);
  }, 30000);

  it("G3: Rejects price negotiation attempt (سجل بيع أسمنت بورتلاندي بـ 15 بدل 25)", async () => {
    const result = await processTelegramMessageWithLLM(
      "سجل بيع أسمنت بورتلاندي - 50 كجم بـ 15 بدل 25",
      TENANT_ID,
      "Test Tenant",
      "Retail",
      "9-5",
      CHAT_ID,
      Date.now()
    );
    expect(result.text || (result as any).finalReply).toMatch(/سعر|لا يمكن|مختلف|تأكد|بيع|15/i);
  }, 30000);

  it("G4: Blocks off-topic requests (أنا عايز أدردش شوية، إيه الأخبار؟)", async () => {
    const result = await processTelegramMessageWithLLM(
      "أنا عايز أدردش شوية، إيه الأخبار؟",
      TENANT_ID,
      "Test Tenant",
      "Retail",
      "9-5",
      CHAT_ID,
      Date.now()
    );
    // Should trigger Small-Talk Short-Circuit
    expect(result.text || (result as any).finalReply).toMatch(/مساعد|مبيعات|لا أستطيع|أهلاً|قولّي/i);
  }, 30000);

  it("G5: Cancels an existing appointment (الغي موعد احمد مكش)", async () => {
    const result = await processTelegramMessageWithLLM(
      "الغي موعد احمد مكش",
      TENANT_ID,
      "Test Tenant",
      "Retail",
      "9-5",
      CHAT_ID,
      Date.now()
    );
    expect(result.text || (result as any).finalReply).toMatch(/إلغاء|الغي|حذف|بنجاح/i);

    const cancelledApp = await prismaSystem.appointment.findFirst({
      where: { tenantId: TENANT_ID, customerName: 'احمد مكش' }
    });
    expect(cancelledApp?.status).toBe('cancelled');
  }, 30000);

  it("G6: Reschedules an existing appointment (أجل موعد احمد مكش لبكرة الساعة 5)", async () => {
    const result = await processTelegramMessageWithLLM(
      "أجل موعد احمد مكش لبكرة الساعة 5",
      TENANT_ID,
      "Test Tenant",
      "Retail",
      "9-5",
      CHAT_ID,
      Date.now()
    );
    expect(result.text || (result as any).finalReply).toMatch(/تأجيل|تعديل|تغير|بنجاح/i);

    const rescheduledApp = await prismaSystem.appointment.findFirst({
      where: { tenantId: TENANT_ID, customerName: 'احمد مكش' }
    });
    expect(rescheduledApp?.status).toBe('rescheduled');
  }, 30000);
});

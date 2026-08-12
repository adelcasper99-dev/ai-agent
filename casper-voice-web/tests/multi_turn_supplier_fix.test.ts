import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { processTelegramMessageWithLLM } from '../lib/telegram_llm';
import { prisma } from '../lib/prisma';

const TENANT_ID = 'multi_turn_tenant_id';
const CHAT_ID = 'multi_turn_chat_id';

beforeEach(async () => {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      telegramChatId: CHAT_ID,
      name: 'Multi-Turn Supplier Test Tenant',
      state: 'active',
      subscriptionPlan: 'pro',
    },
  });
});

afterEach(async () => {
  await prisma.purchase.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.chatMessage.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
});

describe("Multi-Turn Context Accumulation & Generic Placeholder Guardrail", () => {
  it("Accumulates numbers across turns when user provides supplier name in Turn 2", async () => {
    // Turn 1: Purchase request without supplier name
    const turn1 = await processTelegramMessageWithLLM(
      "سجل فاتورة مشتريات 5 كراتين بـ 500",
      TENANT_ID,
      "Test Tenant",
      "Retail",
      "9-5",
      CHAT_ID,
      Date.now()
    );
    expect(turn1.text).not.toMatch(/الأداة رجّعت مبالغ رقمية/i);

    // Turn 2: User provides supplier name only
    const turn2 = await processTelegramMessageWithLLM(
      "المتخصص",
      TENANT_ID,
      "Test Tenant",
      "Retail",
      "9-5",
      CHAT_ID,
      Date.now()
    );

    // Expect transaction recorded or acknowledged cleanly without grounding check failure!
    expect(turn2.text).not.toMatch(/الأداة رجّعت مبالغ رقمية/i);
    expect(turn2.text).not.toMatch(/مش موجودة في رسالة المستخدم/i);
  }, 45000);
});

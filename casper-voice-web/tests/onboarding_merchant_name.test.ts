import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { processTelegramMessageWithLLM } from '../lib/telegram_llm';
import { prismaSystem as prisma } from '../lib/prisma';

const TENANT_ID = 'test_merchant_name_tenant';
const CHAT_ID = 'test_merchant_name_chat';

beforeEach(async () => {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: { merchantName: 'محمود' },
    create: {
      id: TENANT_ID,
      telegramChatId: CHAT_ID,
      name: 'محمصة البركة',
      merchantName: 'محمود',
      state: 'active',
      subscriptionPlan: 'pro',
    },
  });
});

afterEach(async () => {
  await prisma.chatMessage.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
});

describe("Merchant Name & Personalization Tests", () => {
  it("Greets merchant with 'مستر محمود' on small talk", async () => {
    const result = await processTelegramMessageWithLLM(
      "ازيك",
      TENANT_ID,
      "محمصة البركة",
      "تجارة",
      "9-5",
      CHAT_ID,
      Date.now(),
      "محمود"
    );

    expect(result.status).toBe("success");
    expect(result.text).toContain("مستر محمود");
  });

  it("Cleans prefixes like 'أستاذ' and uses 'مستر محمود'", async () => {
    const result = await processTelegramMessageWithLLM(
      "صباح الخير",
      TENANT_ID,
      "محمصة البركة",
      "تجارة",
      "9-5",
      CHAT_ID,
      Date.now(),
      "أستاذ محمود"
    );

    expect(result.status).toBe("success");
    expect(result.text).toContain("مستر محمود");
    expect(result.text).not.toContain("أستاذ محمود");
  });
});

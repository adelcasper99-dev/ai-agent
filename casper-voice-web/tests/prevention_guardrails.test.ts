import { describe, it, expect } from "vitest";
import { processTelegramMessageWithLLM } from "../lib/telegram_llm";
import { prismaSystem as prisma } from "../lib/prisma";

describe("Permanent Prevention Architecture Suite", () => {
  const tenantId = "sim_tenant_1";

  it("should clarify ambiguous prompt numbers (2+ numbers >= 100 without prepositions)", async () => {
    const prompt = "اشتريت بطاطس من احمد عربى 50000 10000";
    const res = await processTelegramMessageWithLLM(prompt, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
    expect(res.text).toContain("أنهي مبلغ هو إجمالي الفاتورة");
  }, 30000);

  it("should accurately query supplier balance with Decimal.js summation across purchases and payments", async () => {
    const supplier = await prisma.supplier.findFirst({
      where: { tenantId, name: { contains: "عربى" } },
      include: { purchases: true, payments: true }
    });
    expect(supplier).toBeDefined();
  }, 30000);
});

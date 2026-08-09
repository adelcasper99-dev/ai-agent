import { processTelegramMessageWithLLM } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

async function main() {
  console.log("--- Testing Exact User Request: 'دفعت لعربى 20000' ---");
  const tenantId = "sim_tenant_1";

  const prompt = "دفعت لعربى 20000";
  console.log(`🗣️ المستخدم: "${prompt}"`);

  const reply = await processTelegramMessageWithLLM(
    prompt,
    tenantId,
    "Test Store",
    "Retail",
    "9am-5pm",
    `chat_pay_araby_${Date.now()}`
  );

  console.log(`🤖 المساعد الذكي:\n${typeof reply === 'object' ? JSON.stringify(reply, null, 2) : reply}`);

  // Query DB Evidence for Supplier "احمد عربى"
  const supplier = await prisma.supplier.findFirst({
    where: { tenantId, name: { contains: "عربى" } },
    include: {
      payments: true,
      purchases: true
    }
  });

  console.log("=== RAW DB EVIDENCE ===");
  console.log("SUPPLIER RECORD AFTER 20k PAYMENT:", JSON.stringify(supplier, null, 2));
}

main().finally(() => prisma.$disconnect());

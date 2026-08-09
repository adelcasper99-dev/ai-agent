import { processTelegramMessageWithLLM } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

async function main() {
  console.log("--- Testing Function #6: log_supplier_payment (Eastern Numerals + Slang) ---");
  const tenantId = "sim_tenant_1";

  const prompt = "دفعت للمورد الحاج محمود 100000 دفعة نقدية";
  console.log(`🗣️ المستخدم: "${prompt}"`);

  const reply = await processTelegramMessageWithLLM(
    prompt,
    tenantId,
    "Test Store",
    "Retail",
    "9am-5pm",
    `chat_sup_pay_${Date.now()}`
  );

  console.log(`🤖 المساعد الذكي:\n${typeof reply === 'object' ? JSON.stringify(reply, null, 2) : reply}`);

  // Raw Database Proof
  const supplier = await prisma.supplier.findFirst({
    where: { tenantId, name: { contains: "محمود" } },
    include: {
      payments: true,
      purchases: true
    }
  });

  console.log("=== RAW DB EVIDENCE ===");
  console.log("SUPPLIER AFTER PAYMENT:", JSON.stringify(supplier, null, 2));
}

main().finally(() => prisma.$disconnect());

import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("--- Testing Exact User Raw Slang Input ---");
  const tenantId = "sim_tenant_1";

  const prompt = "اشتريت 50 طم بطاطس من احمد عربى ب 50000 دفعت 10000";
  console.log(`🗣️ المستخدم (Raw Slang + Typo): "${prompt}"`);

  const reply = await processTelegramMessageWithLLM(
    prompt,
    tenantId,
    "Test Store",
    "Retail",
    "9am-5pm",
    `chat_raw_slang_${Date.now()}`
  );

  console.log(`🤖 المساعد الذكي:\n${typeof reply === 'object' ? JSON.stringify(reply, null, 2) : reply}`);

  // Query DB Evidence
  const purchase = await prisma.purchase.findFirst({
    where: { tenantId, itemName: { contains: "بطاطس" } },
    orderBy: { createdAt: "desc" },
    include: { supplier: true }
  });

  console.log("=== RAW DB EVIDENCE ===");
  console.log("PURCHASE RECORD:", JSON.stringify(purchase, null, 2));
}

main().finally(() => prisma.$disconnect());

import { processTelegramMessageWithLLM } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

async function main() {
  console.log("--- Testing Function #4: log_expense ---");
  const tenantId = "sim_tenant_1";
  
  // Ensure tenant exists
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: { id: tenantId, name: "Test Store Tenant" }
  });

  const prompt = "دفعت 500 جنيه فاتورة الكهرباء للمحل";
  console.log(`🗣️ المستخدم: ${prompt}`);

  const reply = await processTelegramMessageWithLLM(
    prompt,
    tenantId,
    "Test Store",
    "Retail",
    "9am-5pm",
    "chat_expense_1"
  );

  console.log(`🤖 المساعد الذكي:\n${reply}`);

  // Raw Database Verification
  const expense = await prisma.expense.findFirst({
    where: { tenantId, description: "فاتورة الكهرباء للمحل" }
  });

  const journalEntries = await prisma.journalEntry.findMany({
    where: { tenantId, referenceId: expense?.id }
  });

  console.log("=== RAW DB EVIDENCE ===");
  console.log("EXPENSE RECORD:", JSON.stringify(expense, null, 2));
  console.log("JOURNAL ENTRIES:", JSON.stringify(journalEntries, null, 2));
}

main().finally(() => prisma.$disconnect());

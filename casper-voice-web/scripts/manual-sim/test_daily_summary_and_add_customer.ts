import { processTelegramMessageWithLLM } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

async function main() {
  console.log("=== Testing Functions #13 (Daily Summary) & #14 (Add Customer) ===");
  const tenantId = "sim_tenant_1";

  // ----------------------------------------------------
  // Test Function #13: get_financial_summary / get_daily_summary
  // ----------------------------------------------------
  const prompt13 = "تقرير المبيعات والارباح النهاردة كام؟";
  console.log(`\n🗣️ Test Function #13 (Daily Summary): "${prompt13}"`);
  const res13 = await processTelegramMessageWithLLM(prompt13, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response #13:\n", JSON.stringify(res13, null, 2));

  // ----------------------------------------------------
  // Test Function #14: add_customer
  // ----------------------------------------------------
  const prompt14 = "سجل عميل جديد اسمه شركة الامل تليفونه ٠١٠٩٩٩٩٨٨٨٨";
  console.log(`\n🗣️ Test Function #14 (Add Customer): "${prompt14}"`);
  const res14 = await processTelegramMessageWithLLM(prompt14, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response #14:\n", JSON.stringify(res14, null, 2));

  // Verify DB
  const newCustomer = await prisma.customer.findFirst({ where: { tenantId, name: { contains: "الامل" } } });
  console.log("\n=== RAW DB EVIDENCE (NEW CUSTOMER) ===");
  console.log(JSON.stringify(newCustomer ? { id: newCustomer.id, name: newCustomer.name, phone: newCustomer.phone } : null, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);

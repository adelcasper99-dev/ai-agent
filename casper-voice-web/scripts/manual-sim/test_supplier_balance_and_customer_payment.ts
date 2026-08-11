import { processTelegramMessageWithLLM } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

async function main() {
  console.log("=== Testing Functions #7 (Supplier Balance) & #8 (Customer Payment) ===");
  const tenantId = "sim_tenant_1";

  // First, ensure a customer named "الحاج محمود" exists for Function #8 test
  let cust = await prisma.customer.findFirst({ where: { tenantId, name: { contains: "محمود" } } });
  if (!cust) {
    cust = await prisma.customer.create({
      data: { tenantId, name: "الحاج محمود", phone: "01000000000" }
    });
  }

  // ----------------------------------------------------
  // Test Function #7: get_supplier_balance
  // ----------------------------------------------------
  const prompt7 = "كشف حساب المورد احمد عربى كام له؟";
  console.log(`\n🗣️ Test Function #7 (Supplier Balance Inquiry): "${prompt7}"`);
  const res7 = await processTelegramMessageWithLLM(prompt7, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response #7:\n", JSON.stringify(res7, null, 2));

  // ----------------------------------------------------
  // Test Function #8: log_customer_payment (Eastern Arabic numerals: ٥٠٠٠)
  // ----------------------------------------------------
  const prompt8 = "حصلت ٥٠٠٠ من الحاج محمود كاش";
  console.log(`\n🗣️ Test Function #8 (Customer Payment Collection): "${prompt8}"`);
  const res8 = await processTelegramMessageWithLLM(prompt8, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response #8:\n", JSON.stringify(res8, null, 2));

  // Fetch Raw Database Evidence for Customer Payment
  const updatedCust = await prisma.customer.findFirst({
    where: { id: cust.id },
    include: { ledgers: true }
  });
  console.log("\n=== RAW DB EVIDENCE (CUSTOMER LEDGER) ===");
  console.log(JSON.stringify(updatedCust, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);

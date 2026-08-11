import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== VERIFYING AHMED ARABI LEDGER STATEMENT ON CLEAN DB ===");
  const tenantId = "sim_tenant_1";

  // Step 1: Purchase Bill (50k total, 10k paid, 40k deferred)
  const p1 = "اشتريت 50 طم بطاطس من احمد عربى ب 50000 دفعت 10000";
  console.log(`\n1️⃣ Purchase Step: "${p1}"`);
  const r1 = await processTelegramMessageWithLLM(p1, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("Response 1:", r1.text);

  // Step 2: Cash Payout (20k paid)
  const p2 = "دفعت لعربى 20000";
  console.log(`\n2️⃣ Payment Step: "${p2}"`);
  const r2 = await processTelegramMessageWithLLM(p2, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("Response 2:", r2.text);

  // Step 3: Supplier Balance Inquiry
  const p3 = "كشف حساب المورد احمد عربى كام له؟";
  console.log(`\n3️⃣ Balance Inquiry Step: "${p3}"`);
  const r3 = await processTelegramMessageWithLLM(p3, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("Response 3:\n", r3.text);

  await prisma.$disconnect();
}

main().catch(console.error);

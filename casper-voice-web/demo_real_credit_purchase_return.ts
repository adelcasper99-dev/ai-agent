import { processTelegramMessageWithLLM } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

async function main() {
  console.log("==================================================================");
  console.log("🎬 REAL END-TO-END DEMO: Deferred Purchase & Credit Return Workflow");
  console.log("==================================================================");
  const tenantId = "sim_tenant_1";

  // Clean old test records for tenant sim_tenant_1 to give crisp live numbers
  await prisma.supplierPayment.deleteMany({ where: { tenantId } });
  await prisma.purchase.deleteMany({ where: { tenantId } });
  await prisma.journalEntry.deleteMany({ where: { tenantId } });

  // Ensure supplier Ahmed Arabi exists
  let supplier = await prisma.supplier.findFirst({ where: { tenantId, name: { contains: "عربى" } } });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: { tenantId, name: "احمد عربى", phone: "01100000000" }
    });
  }

  // ----------------------------------------------------
  // STEP 1: Purchase Order on Credit (100k total, 20k cash, 80k deferred debt)
  // ----------------------------------------------------
  const prompt1 = "اشتريت 10 طن بطاطس من احمد عربى ب 100000 دفعت 20000";
  console.log(`\n🗣️ STEP 1 (Purchase Order): "${prompt1}"`);
  const res1 = await processTelegramMessageWithLLM(prompt1, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response Step 1:\n", res1.text);

  // ----------------------------------------------------
  // STEP 2: Check Initial Balance
  // ----------------------------------------------------
  const prompt2 = "كشف حساب المورد احمد عربى كام له؟";
  console.log(`\n🗣️ STEP 2 (Balance Inquiry Before Return): "${prompt2}"`);
  const res2 = await processTelegramMessageWithLLM(prompt2, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response Step 2:\n", res2.text);

  // ----------------------------------------------------
  // STEP 3: Deferred Purchase Return (Returned 20k worth of goods, no cash taken)
  // ----------------------------------------------------
  const prompt3 = "رجعت 2 طن بطاطس لاحمد عربى ثمنها 20000 وخصمتهم من حسابه";
  console.log(`\n🗣️ STEP 3 (Credit Purchase Return): "${prompt3}"`);
  const res3 = await processTelegramMessageWithLLM(prompt3, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response Step 3:\n", res3.text);

  // ----------------------------------------------------
  // STEP 4: Check Balance After Return (Debt reduced from 80k -> 60k)
  // ----------------------------------------------------
  const prompt4 = "كشف حساب المورد احمد عربى كام له؟";
  console.log(`\n🗣️ STEP 4 (Balance Inquiry After Return): "${prompt4}"`);
  const res4 = await processTelegramMessageWithLLM(prompt4, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response Step 4:\n", res4.text);

  // ----------------------------------------------------
  // RAW DATABASE PROOF AUDIT
  // ----------------------------------------------------
  const updatedPurchase = await prisma.purchase.findFirst({
    where: { supplierId: supplier.id }
  });
  console.log("\n=== 📊 RAW DB EVIDENCE (PURCHASE RECORD AFTER CREDIT RETURN) ===");
  console.log(JSON.stringify(updatedPurchase, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);

import { processTelegramMessageWithLLM } from "../lib/telegram_llm";
import { prisma } from "../lib/prisma";
import { _resetExhaustedKeysForTesting } from "../lib/apiKeyManager";

const TENANT_ID = "test_catalog_sync_tenant_99";
const TENANT_NAME = "شركة التوريدات والمواد";

async function runTest() {
  _resetExhaustedKeysForTesting();
  console.log("==========================================================================");
  console.log("🧪 SCREENSHOT BUG REPRODUCTION & VERIFICATION TEST");
  console.log("==========================================================================");

  // Setup Clean Tenant
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: { id: TENANT_ID, name: TENANT_NAME, businessType: "مواد بناء", workingHours: "8am-10pm" }
  });

  // Step 1: Purchase 50 tons cement from supplier Hamkasha for 100,000
  console.log("\n▶ Step 1: Executing Purchase Order...");
  const purchasePrompt = "شراء 50 طن اسمنت من حمكشه دفت 100000";
  const purchaseRes = await processTelegramMessageWithLLM(purchasePrompt, TENANT_ID, TENANT_NAME, "مواد بناء", "8am-10pm", "999888");
  console.log("Purchase Result:", purchaseRes.text);

  // Verify Product created in DB
  const productAfterPurchase = await prisma.product.findFirst({
    where: { tenantId: TENANT_ID }
  });
  console.log("📊 Product in DB after Purchase:", productAfterPurchase);

  // Step 2: Sell 5 tons cement to Ahmed Arabi
  console.log("\n▶ Step 2: Executing Sale Order (Fuzzy Match)...");
  const salePrompt = "بيع 5 طن اسمنت ممتاز لأحمد عربي بـ 20000 دفع 5000 كاش والباقي آجل";
  const saleRes = await processTelegramMessageWithLLM(salePrompt, TENANT_ID, TENANT_NAME, "مواد بناء", "8am-10pm", "999888");
  console.log("Sale Result:", saleRes.text);

  // Verify Product Stock deducted to 45
  const productAfterSale = await prisma.product.findFirst({
    where: { tenantId: TENANT_ID }
  });
  console.log("📊 Product in DB after Sale:", productAfterSale);

  if (productAfterSale && productAfterSale.stockQuantity === 45 && !saleRes.text.includes("مش موجود في الكتالوج")) {
    console.log("\n✅ VERIFICATION PASSED: Product Auto-Synced and Stock updated to 45!");
  } else {
    console.error("\n❌ VERIFICATION FAILED!");
  }

  await prisma.$disconnect();
}

runTest().catch(console.error);

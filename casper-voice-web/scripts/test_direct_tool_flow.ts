import { executeTool } from "../lib/telegram_llm";
import { prisma } from "../lib/prisma";

const TENANT_ID = "test_direct_sync_tenant_100";

async function runDirectTest() {
  console.log("==========================================================================");
  console.log("⚡ DIRECT TOOL EXECUTION TEST (OFFLINE DETERMINISTIC VERIFICATION)");
  console.log("==========================================================================");

  // Clean Tenant
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: { id: TENANT_ID, name: "شركة المواد المباشرة", businessType: "مواد بناء", workingHours: "8am-10pm" }
  });

  // Step 1: Execute log_purchase directly
  console.log("\n▶ Step 1: Executing log_purchase...");
  const purchaseArgs = {
    supplier_name: "حمكشه",
    item_name: "اسمنت",
    quantity: 50,
    total_amount: 100000,
    paid_amount: 100000,
    unit: "طن"
  };
  const purchaseRes = await executeTool("log_purchase", purchaseArgs, TENANT_ID, "شراء 50 طن اسمنت من حمكشه دفت 100000");
  console.log("Purchase Result:", purchaseRes.resultText);

  // Check product in DB after purchase
  const productAfterPurchase = await prisma.product.findFirst({
    where: { tenantId: TENANT_ID }
  });
  console.log("📊 Product in DB after Purchase:", productAfterPurchase);

  // Step 2: Execute log_sale directly with fuzzy name variant "اسمنت ممتاز"
  console.log("\n▶ Step 2: Executing log_sale with fuzzy product name (اسمنت ممتاز)...");
  const saleArgs = {
    item_name: "اسمنت ممتاز",
    quantity: 5,
    price: 4000,
    customer_name: "أحمد عربي",
    paid_amount: 5000,
    deferred_amount: 15000
  };
  const saleRes = await executeTool("log_sale", saleArgs, TENANT_ID, "بيع 5 طن اسمنت ممتاز لأحمد عربي بـ 20000 دفع 5000 كاش والباقي آجل");
  console.log("Sale Result:", saleRes.resultText);

  // Check product in DB after sale
  const productAfterSale = await prisma.product.findFirst({
    where: { tenantId: TENANT_ID }
  });
  console.log("📊 Product in DB after Sale:", productAfterSale);

  if (
    purchaseRes.success &&
    saleRes.success &&
    productAfterSale &&
    productAfterSale.stockQuantity === 45 &&
    saleRes.resultText.includes("تم تسجيل بيع")
  ) {
    console.log("\n✅ DETERMINISTIC DIRECT TEST PASSED: Product Auto-Synced on Purchase and Deducted on Sale (Stock 50 -> 45)!");
  } else {
    console.error("\n❌ DIRECT TEST FAILED!");
  }

  await prisma.$disconnect();
}

runDirectTest().catch(console.error);

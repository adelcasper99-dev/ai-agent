const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { executeTool } = require('@/lib/telegram_llm');

async function runFinancialSanityTests() {
  console.log("==================================================");
  console.log("FINANCIAL SANITY & AUTO-NORMALIZATION TEST SUITE");
  console.log("==================================================");

  let tenant = await prisma.tenant.findFirst({ where: { name: "Adel Casper" } });
  if (!tenant) tenant = await prisma.tenant.findFirst();
  const tenantId = tenant.id;

  // ----------------------------------------------------
  // TEST 1: STANDARD CASH SALE (Hallucinated paid_amount=200 normalized to 100)
  // ----------------------------------------------------
  console.log("\n--> TEST 1: Standard Sale ('بعت 2 مسامير ب 100' with hallucinated paid=200)...");
  const test1_msgId = Date.now();
  const res1 = await executeTool(
    "log_sale",
    { item_name: "مسامير", price: 50, quantity: 2, paid_amount: 200 },
    tenantId,
    "بعت 2 مسامير ب 100",
    test1_msgId,
    0
  );
  console.log("Result 1:", res1);
  console.assert(res1.success === true, "TEST 1 FAILED: Standard sale must succeed with normalized cash payment!");
  console.assert(res1.resultText.includes("مدفوع: 100"), "TEST 1 FAILED: paidAmount must be normalized to 100!");
  if (res1.success === true && res1.resultText.includes("مدفوع: 100")) {
    console.log("✅ TEST 1 PASSED: Standard sale succeeded with normalized cash payment (100 EGP) and success message sent!");
    await prisma.sale.deleteMany({ where: { idempotencyKey: { contains: `msg_${test1_msgId}` } } });
  }

  // ----------------------------------------------------
  // TEST 2: LEGITIMATE PARTIAL PAYMENT ('دفع 40 والباقي آجل')
  // ----------------------------------------------------
  console.log("\n--> TEST 2: Legitimate Partial Payment ('بعت 2 مسامير ب 100 دفع 40 والباقي آجل')...");
  const test2_msgId = Date.now() + 1;
  const res2 = await executeTool(
    "log_sale",
    { item_name: "مسامير", price: 50, quantity: 2, paid_amount: 40, deferred_amount: 60, customer_name: "علي" },
    tenantId,
    "بعت 2 مسامير ب 100 دفع 40 والباقي آجل للعميل علي",
    test2_msgId,
    0
  );
  console.log("Result 2:", res2);
  console.assert(res2.success === true, "TEST 2 FAILED: Legitimate partial payment must pass!");
  console.assert(res2.resultText.includes("مدفوع: 40"), "TEST 2 FAILED: paidAmount must be 40!");
  if (res2.success === true && res2.resultText.includes("مدفوع: 40")) {
    console.log("✅ TEST 2 PASSED: Legitimate partial payment (40 paid, 60 deferred) passed cleanly!");
    await prisma.sale.deleteMany({ where: { idempotencyKey: { contains: `msg_${test2_msgId}` } } });
  }

  // ----------------------------------------------------
  // TEST 3: IMPOSSIBLE PAID AMOUNT IN USER TEXT ('دفع 200' when total=100)
  // ----------------------------------------------------
  console.log("\n--> TEST 3: Impossible Explicit Paid Amount ('بعت 2 مسامير ب 100 دفع 200')...");
  const test3_msgId = Date.now() + 2;
  const res3 = await executeTool(
    "log_sale",
    { item_name: "مسامير", price: 50, quantity: 2, paid_amount: 200, deferred_amount: 0 },
    tenantId,
    "بعت 2 مسامير ب 100 دفع 200",
    test3_msgId,
    0
  );
  console.log("Result 3:", res3);
  console.assert(res3.success === false, "TEST 3 FAILED: Impossible paid amount (200 > 100) must be blocked!");
  if (res3.success === false) {
    console.log("✅ TEST 3 PASSED: Impossible explicit paid amount (200 > 100) was blocked by Financial Sanity Guard!");
  }
}

runFinancialSanityTests().finally(() => prisma.$disconnect());

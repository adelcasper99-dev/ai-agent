const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { executeTool } = require('./lib/telegram_llm');

async function runFinancialSanityTests() {
  console.log("==================================================");
  console.log("FINANCIAL SANITY & PAID_AMOUNT GROUNDING TEST");
  console.log("==================================================");

  let tenant = await prisma.tenant.findFirst({ where: { name: "Adel Casper" } });
  if (!tenant) tenant = await prisma.tenant.findFirst();
  const tenantId = tenant.id;

  // ----------------------------------------------------
  // TEST 1: BUG CASE (paid_amount > total = 200 > 100)
  // ----------------------------------------------------
  console.log("\n--> TEST 1: Excess paid_amount (paid=200, total=100)...");
  const test1_msgId = Date.now();
  const res1 = await executeTool(
    "log_sale",
    { item_name: "مسامير", price: 50, quantity: 2, paid_amount: 200 },
    tenantId,
    "بعت 2 مسامير ب 100",
    test1_msgId,
    0
  );
  console.log("Result 1 (Excess Paid):", res1);
  console.assert(res1.success === false, "TEST 1 FAILED: Excess paid_amount must be blocked!");
  if (res1.success === false) {
    console.log("✅ TEST 1 PASSED: Excess paid_amount (200 > 100) was successfully blocked!");
  }

  // ----------------------------------------------------
  // TEST 2: ADVERSARIAL TEST (Legitimate Partial Payment: paid=40, deferred=60 for total=100)
  // ----------------------------------------------------
  console.log("\n--> TEST 2: Legitimate Partial Payment (paid=40, deferred=60, total=100)...");
  const test2_msgId = Date.now() + 1;
  const res2 = await executeTool(
    "log_sale",
    { item_name: "مسامير", price: 50, quantity: 2, paid_amount: 40, deferred_amount: 60, customer_name: "علي" },
    tenantId,
    "بعت 2 مسامير ب 100 دفع 40 والباقي آجل للعميل علي",
    test2_msgId,
    0
  );
  console.log("Result 2 (Legitimate Partial):", res2);
  console.assert(res2.success === true, "TEST 2 FAILED: Legitimate partial payment must pass!");
  if (res2.success === true) {
    console.log("✅ TEST 2 PASSED: Legitimate partial payment (40 paid, 60 deferred) passed cleanly!");
    // Clean up created sale
    await prisma.sale.deleteMany({ where: { idempotencyKey: { contains: `msg_${test2_msgId}` } } });
  }

  // ----------------------------------------------------
  // TEST 3: UNGROUNDED CUSTOM PAID AMOUNT (paid=40 when 40 is NOT in text)
  // ----------------------------------------------------
  console.log("\n--> TEST 3: Ungrounded Custom Paid Amount (paid=40 when prompt says 'بعت 2 مسامير ب 100')...");
  const test3_msgId = Date.now() + 2;
  const res3 = await executeTool(
    "log_sale",
    { item_name: "مسامير", price: 50, quantity: 2, paid_amount: 40, deferred_amount: 60 },
    tenantId,
    "بعت 2 مسامير ب 100",
    test3_msgId,
    0
  );
  console.log("Result 3 (Ungrounded Paid Amount):", res3);
  console.assert(res3.success === false, "TEST 3 FAILED: Ungrounded paid amount must be blocked!");
  if (res3.success === false) {
    console.log("✅ TEST 3 PASSED: Ungrounded custom paid amount was blocked by Grounding Guard!");
  }

  // ----------------------------------------------------
  // TEST 4: PURCHASE EXCESS PAID TEST (log_purchase paid=200, total=100)
  // ----------------------------------------------------
  console.log("\n--> TEST 4: Purchase Excess Paid (paid=200, total=100)...");
  const test4_msgId = Date.now() + 3;
  const res4 = await executeTool(
    "log_purchase",
    { supplier_name: "المورد علي", item_name: "خشب", total_amount: 100, paid_amount: 200 },
    tenantId,
    "اشتريت خشب ب 100 من المورد علي",
    test4_msgId,
    0
  );
  console.log("Result 4 (Purchase Excess Paid):", res4);
  console.assert(res4.success === false, "TEST 4 FAILED: Excess purchase paid_amount must be blocked!");
  if (res4.success === false) {
    console.log("✅ TEST 4 PASSED: Excess purchase paid_amount was blocked by Financial Sanity Guard!");
  }
}

runFinancialSanityTests().finally(() => prisma.$disconnect());

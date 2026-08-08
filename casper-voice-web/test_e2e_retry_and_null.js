const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { executeTool } = require('./lib/telegram_llm');

async function runTests() {
  console.log("==================================================");
  console.log("TEST 1: E2E WEBHOOK RETRY SIMULATION WITH DB ROW COUNT");
  console.log("==================================================");

  // Pick or create a test tenant
  let tenant = await prisma.tenant.findFirst({ where: { name: "Adel Casper" } });
  if (!tenant) {
    tenant = await prisma.tenant.findFirst();
  }
  const tenantId = tenant.id;
  const testMsgId = 999111222; // Simulated Telegram Message ID

  // Clean up any old test sales with this msgId
  await prisma.sale.deleteMany({
    where: {
      idempotencyKey: { contains: `msg_${testMsgId}` }
    }
  });

  const countBefore = await prisma.sale.count({
    where: { tenantId, idempotencyKey: { contains: `msg_${testMsgId}` } }
  });
  console.log(`[BEFORE TEST] Existing sales matching testMsgId: ${countBefore}`);

  // FIRST EXECUTION (Simulating first Webhook arrival)
  console.log("\n--> Executing FIRST call (msgId: 999111222)...");
  const res1 = await executeTool(
    "log_sale",
    { item_name: "مسامير اختبار", price: 50, quantity: 2, paid_amount: 100, deferred_amount: 0 },
    tenantId,
    "بعت 2 مسامير اختبار ب 100",
    testMsgId,
    0
  );
  console.log("Result 1:", res1);

  const countAfterFirst = await prisma.sale.count({
    where: { tenantId, idempotencyKey: { contains: `msg_${testMsgId}` } }
  });
  console.log(`[AFTER CALL 1] Total sales in DB: ${countAfterFirst}`);

  // SECOND EXECUTION (Simulating Telegram Webhook Retry with exact same message ID)
  console.log("\n--> Executing SECOND call (RETRY with exact same msgId: 999111222)...");
  const res2 = await executeTool(
    "log_sale",
    { item_name: "مسامير اختبار", price: 50, quantity: 2, paid_amount: 100, deferred_amount: 0 },
    tenantId,
    "بعت 2 مسامير اختبار ب 100",
    testMsgId,
    0
  );
  console.log("Result 2 (Retry Response):", res2);

  const countAfterSecond = await prisma.sale.count({
    where: { tenantId, idempotencyKey: { contains: `msg_${testMsgId}` } }
  });
  console.log(`[AFTER CALL 2 - RETRY] Total sales in DB: ${countAfterSecond}`);

  if (countAfterFirst === 1 && countAfterSecond === 1) {
    console.log("\n✅ SUCCESS: Retry WAS PREVENTED! DB count remained exactly 1.");
  } else {
    console.error("\n❌ FAILURE: Duplicate sales row created!");
  }

  console.log("\n==================================================");
  console.log("TEST 2: SQLITE NULL ON COMPOSITE UNIQUE CHECK");
  console.log("==================================================");
  
  try {
    const nullSale1 = await prisma.sale.create({
      data: {
        tenantId,
        itemName: "اختبار نول 1",
        price: 10,
        quantity: 1,
        total: 10,
        paidAmount: 10,
        deferredAmount: 0,
        idempotencyKey: null
      }
    });
    const nullSale2 = await prisma.sale.create({
      data: {
        tenantId,
        itemName: "اختبار نول 2",
        price: 10,
        quantity: 1,
        total: 10,
        paidAmount: 10,
        deferredAmount: 0,
        idempotencyKey: null
      }
    });
    console.log(`Inserted 2 sales with idempotencyKey = NULL for tenant ${tenantId} successfully!`);
    console.log("Null Sale 1 ID:", nullSale1.id);
    console.log("Null Sale 2 ID:", nullSale2.id);
    console.log("✅ SUCCESS: SQLite allows multiple NULL idempotencyKey values per tenant!");

    // Clean up test null rows
    await prisma.sale.delete({ where: { id: nullSale1.id } });
    await prisma.sale.delete({ where: { id: nullSale2.id } });
  } catch (e) {
    console.error("❌ FAILURE: SQLite composite unique failed on NULL values:", e);
  }

  // Clean up test sale
  await prisma.sale.deleteMany({
    where: {
      idempotencyKey: { contains: `msg_${testMsgId}` }
    }
  });
}

runTests().finally(() => prisma.$disconnect());

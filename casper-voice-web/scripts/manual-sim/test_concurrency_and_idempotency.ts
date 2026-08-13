import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";
import { executeTool } from "../../lib/telegram_llm";

const prisma = new PrismaClient();
const TENANT_ID = "concurrent-stress-tenant";
const CUSTOMER_NAME = "رضا التزامن والتكرار";
const CUSTOMER_PHONE = "01099900088";

async function runConcurrencyAndIdempotencyTest() {
  console.log("==========================================================================");
  console.log("⚡ STARTING IDEMPOTENCY & CONCURRENCY STRESS TEST SUITE");
  console.log("==========================================================================");

  // 1. Setup Tenant & Clean Slate
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: { id: TENANT_ID, name: "Concurrent Stress Tenant" },
  });

  await prisma.customerLedgerEntry.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.journalEntry.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.sale.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.product.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.customer.deleteMany({ where: { tenantId: TENANT_ID } });

  const customer = await prisma.customer.create({
    data: { name: CUSTOMER_NAME, phone: CUSTOMER_PHONE, tenantId: TENANT_ID },
  });

  await prisma.product.createMany({
    data: [
      { name: "حديد تسليح", isStockItem: false, tenantId: TENANT_ID, unitPrice: 1000 },
      { name: "أسمنت بورتلاندي", isStockItem: false, tenantId: TENANT_ID, unitPrice: 500 },
      { name: "طوب أحمر", isStockItem: false, tenantId: TENANT_ID, unitPrice: 250 },
    ],
  });

  // 2. TEST C1: 5 Simultaneous Mutations (3 Sales + 2 Payments)
  console.log("\n▶ TEST C1: Firing 5 simultaneous Promise.all mutations (3 Sales + 2 Payments)...");
  
  const results = await Promise.all([
    executeTool("log_sale", { item_name: "حديد تسليح", price: 1000, quantity: 1, customer_name: CUSTOMER_NAME, paid_amount: 0, deferred_amount: 1000 }, TENANT_ID, `بيع 1 حديد تسليح بـ 1000 آجل لـ ${CUSTOMER_NAME}`, 101, 0),
    executeTool("log_sale", { item_name: "أسمنت بورتلاندي", price: 500, quantity: 1, customer_name: CUSTOMER_NAME, paid_amount: 0, deferred_amount: 500 }, TENANT_ID, `بيع 1 أسمنت بورتلاندي بـ 500 آجل لـ ${CUSTOMER_NAME}`, 102, 0),
    executeTool("log_sale", { item_name: "طوب أحمر", price: 250, quantity: 1, customer_name: CUSTOMER_NAME, paid_amount: 0, deferred_amount: 250 }, TENANT_ID, `بيع 1 طوب أحمر بـ 250 آجل لـ ${CUSTOMER_NAME}`, 103, 0),
    executeTool("log_customer_payment", { customer_name: CUSTOMER_NAME, amount: 300, payment_method: "cash" }, TENANT_ID, `سداد 300 كاش من ${CUSTOMER_NAME}`, 104, 0),
    executeTool("log_customer_payment", { customer_name: CUSTOMER_NAME, amount: 200, payment_method: "cash" }, TENANT_ID, `سداد 200 كاش من ${CUSTOMER_NAME}`, 105, 0),
  ]);

  results.forEach((r, idx) => {
    console.log(`Result #${idx + 1}: ${r.resultText}`);
  });

  // Query DB directly
  const entries = await prisma.customerLedgerEntry.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "asc" },
  });

  const saleDebits = entries.filter((e) => e.entryType === "SALE_DEBIT");
  const paymentCredits = entries.filter((e) => e.entryType === "PAYMENT_CREDIT");

  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);

  entries.forEach((e) => {
    if (e.entryType === "SALE_DEBIT") totalDebit = totalDebit.plus(new Decimal(e.amount));
    if (e.entryType === "PAYMENT_CREDIT") totalCredit = totalCredit.plus(new Decimal(e.amount));
  });

  const netBalance = totalDebit.minus(totalCredit);

  console.log("\n📊 RECORDED LEDGER AUDIT:");
  console.log(`- SALE_DEBIT Entries: ${saleDebits.length} (Expected: 3)`);
  console.log(`- PAYMENT_CREDIT Entries: ${paymentCredits.length} (Expected: 2)`);
  console.log(`- Total Debit: ${totalDebit.toString()} EGP | Total Credit: ${totalCredit.toString()} EGP`);
  console.log(`- Net Customer Debt Balance: ${netBalance.toString()} EGP (Expected: 1250 EGP)`);

  if (saleDebits.length === 3 && paymentCredits.length === 2 && netBalance.equals(new Decimal(1250))) {
    console.log("🎉 TEST C1 (CONCURRENT LEDGER INTEGRITY) PASSED 100%!");
  } else {
    throw new Error("Test C1 failed math assertions!");
  }

  // 3. TEST C2: Idempotency Replay Guard
  console.log("\n▶ TEST C2: Testing Idempotency Replay (firing identical message 3 times)...");
  
  const r1 = await executeTool("log_sale", { item_name: "حديد تسليح", price: 1000, quantity: 1, customer_name: CUSTOMER_NAME, paid_amount: 1000 }, TENANT_ID, `بيع 1 حديد تسليح بـ 1000 كاش لـ ${CUSTOMER_NAME}`, 999, 0);
  const r2 = await executeTool("log_sale", { item_name: "حديد تسليح", price: 1000, quantity: 1, customer_name: CUSTOMER_NAME, paid_amount: 1000 }, TENANT_ID, `بيع 1 حديد تسليح بـ 1000 كاش لـ ${CUSTOMER_NAME}`, 999, 0);
  const r3 = await executeTool("log_sale", { item_name: "حديد تسليح", price: 1000, quantity: 1, customer_name: CUSTOMER_NAME, paid_amount: 1000 }, TENANT_ID, `بيع 1 حديد تسليح بـ 1000 كاش لـ ${CUSTOMER_NAME}`, 999, 0);

  console.log(`- Replay Call 1: ${r1.resultText}`);
  console.log(`- Replay Call 2: ${r2.resultText}`);
  console.log(`- Replay Call 3: ${r3.resultText}`);

  const cashSalesCount = await prisma.sale.count({
    where: { tenantId: TENANT_ID, itemName: "حديد تسليح", paidAmount: 1000 },
  });

  console.log(`- Total Cash Sales Recorded in DB: ${cashSalesCount} (Expected: 1)`);

  if (cashSalesCount === 1 && r2.resultText.includes("تمت العملية بنجاح")) {
    console.log("🎉 TEST C2 (IDEMPOTENCY REPLAY GUARD) PASSED 100%!");
  } else {
    throw new Error("Test C2 failed idempotency assertion!");
  }

  await prisma.$disconnect();
}

runConcurrencyAndIdempotencyTest().catch((e) => {
  console.error("❌ Concurrency Test Error:", e);
  process.exit(1);
});

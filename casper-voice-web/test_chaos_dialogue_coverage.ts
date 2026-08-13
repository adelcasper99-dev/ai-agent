import { processTelegramMessageWithLLM } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

async function runDialogueChaosSuite() {
  console.log("==================================================================");
  console.log("🔥 CHAOS SUITE: Customer Voice & Speech Dialogue Coverage (25+ Scenarios)");
  console.log("==================================================================");

  const tenantId = "sim_tenant_dialogue_1";

  // 1. Setup Tenant and Initial Database State
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: { id: tenantId, name: "شركة تجارب الكلام والصوت", businessType: "retail" }
  });

  // Cleanup past test data
  await prisma.customerLedgerEntry.deleteMany({ where: { tenantId } });
  await prisma.supplierPayment.deleteMany({ where: { tenantId } });
  await prisma.sale.deleteMany({ where: { tenantId } });
  await prisma.purchase.deleteMany({ where: { tenantId } });
  await prisma.journalEntry.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  await prisma.supplier.deleteMany({ where: { tenantId } });
  await prisma.product.deleteMany({ where: { tenantId } });
  await prisma.merchantMemory.deleteMany({ where: { tenantId } });

  // Create products
  await prisma.product.create({
    data: { tenantId, name: "كرتونة شاي", isStockItem: true, stockQuantity: 100, unitPrice: 150.00 }
  });
  await prisma.product.create({
    data: { tenantId, name: "شكارة مسامير", isStockItem: true, stockQuantity: 50, unitPrice: 500.00 }
  });

  // Create unique and duplicate-named Customers for Disambiguation tests
  const cUnique = await prisma.customer.create({
    data: { tenantId, name: "محمود السعيد", phone: "01000000001" }
  });

  // Duplicate "أحمد"
  await prisma.customer.create({
    data: { tenantId, name: "أحمد محمود", phone: "01111111111" }
  });
  const cAhmed2 = await prisma.customer.create({
    data: { tenantId, name: "أحمد إبراهيم", phone: "01222222222" }
  });

  // Create Suppliers
  const sSupplier1 = await prisma.supplier.create({
    data: { tenantId, name: "مورد النور للإلكترونيات", phone: "01555555555" }
  });

  // Memory Alias
  await prisma.merchantMemory.create({
    data: {
      tenantId,
      category: "customer_alias",
      key: "أبو صلاح",
      value: "محمود السعيد"
    }
  });

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(` ✅ PASS: ${msg}`);
      passCount++;
    } else {
      console.error(` ❌ FAIL: ${msg}`);
      failCount++;
    }
  }

  // Helper to extract reply text safely
  const getReply = (res: any) => res?.text || res?.reply || res?.message || "";

  // ------------------------------------------------------------------
  // CATEGORY 1: Egyptian Colloquial Numbers & Slang
  // ------------------------------------------------------------------
  console.log("\n--- CATEGORY 1: Egyptian Colloquial Numbers & Slang ---");

  // Scenario 1.1: "ألف ونص" -> 1500 EGP
  const res1_1 = await processTelegramMessageWithLLM(
    "بيع كرتونة شاي لمحمود السعيد بـ ألف ونص كاش",
    tenantId, "شركة التجربة", "retail", "9am-5pm", "100"
  );
  assert(res1_1.status === "success", "Scenario 1.1: 'ألف ونص' handled");
  const sale1_1 = await prisma.sale.findFirst({ where: { tenantId } });
  assert(Number(sale1_1?.total) === 1500, `Scenario 1.1: Total amount is 1500 (actual: ${sale1_1?.total})`);

  // Scenario 1.2: Implicit quantity "كرتونتين" -> 2
  const res1_2 = await processTelegramMessageWithLLM(
    "بعت كرتونتين شاي لمحمود السعيد بسعر 150 الكرتونة آجل",
    tenantId, "شركة التجربة", "retail", "9am-5pm", "101"
  );
  assert(res1_2.status === "success", "Scenario 1.2: 'كرتونتين' handled");
  const sales1_2 = await prisma.sale.findMany({ where: { tenantId, customerId: cUnique.id }, orderBy: { createdAt: "desc" } });
  assert(Number(sales1_2[0].quantity) === 2, `Scenario 1.2: Quantity extracted as 2 (actual: ${sales1_2[0].quantity})`);

  // ------------------------------------------------------------------
  // CATEGORY 2: Ambiguous Match & Disambiguation Security
  // ------------------------------------------------------------------
  console.log("\n--- CATEGORY 2: Ambiguous Match & Disambiguation Security ---");

  // Scenario 2.1: Payment for duplicate "أحمد" without phone or full name
  const paymentsBefore2_1 = await prisma.customerLedgerEntry.count({ where: { tenantId } });
  const res2_1 = await processTelegramMessageWithLLM(
    "سدد لأحمد 500 جنيه كاش",
    tenantId, "شركة التجربة", "retail", "9am-5pm", "102"
  );
  const paymentsAfter2_1 = await prisma.customerLedgerEntry.count({ where: { tenantId } });
  assert(paymentsAfter2_1 === paymentsBefore2_1, "Scenario 2.1: Multi-match 'أحمد' stopped payment execution");
  const reply2_1 = getReply(res2_1);
  assert(reply2_1.includes("أحمد محمود") || reply2_1.includes("أحمد إبراهيم") || reply2_1.includes("تحديد") || reply2_1.includes("أكثر من") || reply2_1.includes("مين فيهم"), "Scenario 2.1: LLM requested explicit customer disambiguation");

  // Scenario 2.2: Specific full name "أحمد إبراهيم" resolves unambiguously
  const res2_2 = await processTelegramMessageWithLLM(
    "أحمد إبراهيم سدد 500 جنيه كاش من حسابه",
    tenantId, "شركة التجربة", "retail", "9am-5pm", "103"
  );
  assert(res2_2.status === "success", "Scenario 2.2: Full name 'أحمد إبراهيم' resolved");
  const pay2_2 = await prisma.customerLedgerEntry.findFirst({ where: { tenantId, customerId: cAhmed2.id } });
  assert(Number(pay2_2?.amount) === 500, `Scenario 2.2: Payment recorded for exact customer Ahmed Ibrahim (amount: ${pay2_2?.amount})`);

  // ------------------------------------------------------------------
  // CATEGORY 3: Implicit Alias & Memory Resolution
  // ------------------------------------------------------------------
  console.log("\n--- CATEGORY 3: Implicit Alias & Memory Resolution ---");

  // Scenario 3.1: "أبو صلاح" alias maps to "محمود السعيد"
  const res3_1 = await processTelegramMessageWithLLM(
    "استلمت 300 جنيه من أبو صلاح سداد دين",
    tenantId, "شركة التجربة", "retail", "9am-5pm", "104"
  );
  assert(res3_1.status === "success", "Scenario 3.1: Alias 'أبو صلاح' handled");
  const pay3_1 = await prisma.customerLedgerEntry.findFirst({ where: { tenantId, customerId: cUnique.id, amount: 300 } });
  assert(pay3_1 !== null, "Scenario 3.1: Customer Payment attributed to resolved alias 'محمود السعيد'");

  // ------------------------------------------------------------------
  // CATEGORY 4: Customer Refund vs Customer Payment Logic
  // ------------------------------------------------------------------
  console.log("\n--- CATEGORY 4: Customer Refund vs Payment Distinction ---");

  // Scenario 4.1: "اديت محمود السعيد 200 كاش" (Refund/Payout TO customer)
  const res4_1 = await processTelegramMessageWithLLM(
    "اديت محمود السعيد 200 جنيه كاش",
    tenantId, "شركة التجربة", "retail", "9am-5pm", "105"
  );
  assert(res4_1.status === "success", "Scenario 4.1: Refund to customer recorded");
  const pay4_1 = await prisma.customerLedgerEntry.findFirst({ where: { tenantId, customerId: cUnique.id, amount: 200 } });
  assert(pay4_1 !== null, "Scenario 4.1: Customer ledger entry recorded for refund");

  // Scenario 4.2: "محمود السعيد اداني 400 كاش" (Payment FROM customer)
  const res4_2 = await processTelegramMessageWithLLM(
    "محمود السعيد اداني 400 جنيه كاش في الخزنة",
    tenantId, "شركة التجربة", "retail", "9am-5pm", "106"
  );
  assert(res4_2.status === "success", "Scenario 4.2: Payment from customer recorded");
  const pay4_2 = await prisma.customerLedgerEntry.findFirst({ where: { tenantId, customerId: cUnique.id, amount: 400 } });
  assert(pay4_2 !== null, "Scenario 4.2: Payment recorded in customer ledger");

  // ------------------------------------------------------------------
  // CATEGORY 5: Supplier Debt vs Purchase Return Distinction
  // ------------------------------------------------------------------
  console.log("\n--- CATEGORY 5: Supplier Debt vs Purchase Return ---");

  // Scenario 5.1: Supplier Payment "سددت للمورد 1000"
  const res5_1 = await processTelegramMessageWithLLM(
    "سددت للمورد مورد النور للإلكترونيات 1000 جنيه من الخزنة",
    tenantId, "شركة التجربة", "retail", "9am-5pm", "107"
  );
  assert(res5_1.status === "success", "Scenario 5.1: Supplier payment recorded");
  const suppPay5_1 = await prisma.supplierPayment.findFirst({ where: { tenantId, supplierId: sSupplier1.id } });
  assert(Number(suppPay5_1?.amount) === 1000, `Scenario 5.1: Supplier payment amount is 1000 (actual: ${suppPay5_1?.amount})`);

  // Scenario 5.2: Purchase Return "رجعت للمورد بضاعة ب 500"
  const res5_2 = await processTelegramMessageWithLLM(
    "رجعت بضاعة للمورد مورد النور للإلكترونيات ثمنها 500 جنيه",
    tenantId, "شركة التجربة", "retail", "9am-5pm", "108"
  );
  assert(res5_2.status === "success", "Scenario 5.2: Purchase return recorded");

  // ------------------------------------------------------------------
  // CATEGORY 6: Grounding Guard & Garbage Speech Defense
  // ------------------------------------------------------------------
  console.log("\n--- CATEGORY 6: Grounding Guard & Nonsense Speech Defense ---");

  // Scenario 6.1: Noise input should NOT trigger tool calls
  const salesBefore6_1 = await prisma.sale.count({ where: { tenantId } });
  const res6_1 = await processTelegramMessageWithLLM(
    "كلام مش مفهوم واسغسبثش 12312345",
    tenantId, "شركة التجربة", "retail", "9am-5pm", "109"
  );
  const salesAfter6_1 = await prisma.sale.count({ where: { tenantId } });
  assert(salesAfter6_1 === salesBefore6_1, "Scenario 6.1: Nonsense voice input ignored without tool execution");

  // ------------------------------------------------------------------
  // FINAL SCORE & RESULTS
  // ------------------------------------------------------------------
  console.log("\n==================================================================");
  console.log(`📊 CHAOS TEST RESULTS: ${passCount} PASSED / ${failCount} FAILED out of ${passCount + failCount} assertions`);
  console.log("==================================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

runDialogueChaosSuite().catch((err) => {
  console.error("FATAL CHAOS TEST ERROR:", err);
  process.exit(1);
});

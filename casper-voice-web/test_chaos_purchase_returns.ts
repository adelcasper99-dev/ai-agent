import { processTelegramMessageWithLLM } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

async function runChaosTests() {
  console.log("==================================================================");
  console.log("🔥 CHAOS SUITE: log_purchase_return (Partial vs Full Returns)");
  console.log("==================================================================");
  const tenantId = "sim_tenant_1";

  // Ensure tenant exists
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: { id: tenantId, name: "شركة الاختبار الشامل", businessType: "retail" }
  });

  // Cleanup past chaos test data for sim_tenant_1
  await prisma.supplierPayment.deleteMany({ where: { tenantId } });
  await prisma.purchase.deleteMany({ where: { tenantId } });
  await prisma.journalEntry.deleteMany({ where: { tenantId } });

  let supplier = await prisma.supplier.findFirst({ where: { tenantId, name: { contains: "مورد الاختبار" } } });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: { tenantId, name: "مورد الاختبار الشامل", phone: "01234567890" }
    });
  }

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

  // ------------------------------------------------------------------
  // TEST 1: Initial Purchase on Credit (Total: 100k, Cash: 20k, Deferred: 80k)
  // ------------------------------------------------------------------
  console.log("\n--- TEST 1: Setup Initial Purchase on Credit ---");
  const p1Res = await processTelegramMessageWithLLM(
    "اشتريت 100 كرتونة بضاعة من مورد الاختبار الشامل ب 100000 دفعت 20000",
    tenantId, "شركة الاختبار", "retail", "9am-5pm", "111222333"
  );
  assert(p1Res.status === "success", "Purchase #1 recorded successfully");

  const purchase1 = await prisma.purchase.findFirst({ where: { tenantId, supplierId: supplier.id } });
  assert(Number(purchase1?.deferredAmount) === 80000, `Purchase #1 deferred is 80000 (actual: ${purchase1?.deferredAmount})`);

  // ------------------------------------------------------------------
  // TEST 2: Partial Purchase Return (Return 30k worth of items)
  // Expected: Deferred debt drops from 80k -> 50k
  // ------------------------------------------------------------------
  console.log("\n--- TEST 2: Partial Purchase Return (30,000 EGP) ---");
  const ret1Res = await processTelegramMessageWithLLM(
    "رجعت 30 كرتونة للمورد مورد الاختبار الشامل ثمنها 30000",
    tenantId, "شركة الاختبار", "retail", "9am-5pm", "111222333"
  );
  assert(ret1Res.status === "success", "Partial return recorded");

  const purchase1AfterPartial = await prisma.purchase.findFirst({ where: { tenantId, id: purchase1!.id } });
  assert(Number(purchase1AfterPartial?.deferredAmount) === 50000, `Purchase #1 deferred reduced to 50000 (actual: ${purchase1AfterPartial?.deferredAmount})`);
  assert(Number(purchase1AfterPartial?.paidAmount) === 50000, `Purchase #1 paidAmount updated to 50000 (actual: ${purchase1AfterPartial?.paidAmount})`);

  // Verify Journal Entries for Partial Return
  const partialJe = await prisma.journalEntry.findMany({ where: { tenantId, description: { contains: "مرتجع مشتريات" } } });
  assert(partialJe.length === 2, `2 Journal entries created for return (1 AP debit, 1 Inventory credit)`);

  // ------------------------------------------------------------------
  // TEST 3: Add Second Purchase (Total: 40k, Deferred: 40k)
  // Total Open Debt is now 50k (P1) + 40k (P2) = 90k
  // ------------------------------------------------------------------
  console.log("\n--- TEST 3: Add Second Purchase on Credit (40,000 EGP) ---");
  await processTelegramMessageWithLLM(
    "اشتريت شحنة جديدة من مورد الاختبار الشامل بقيمة 40000 آجل",
    tenantId, "شركة الاختبار", "retail", "9am-5pm", "111222333"
  );
  const purchasesBeforeMultiReturn = await prisma.purchase.findMany({ where: { tenantId, supplierId: supplier.id }, orderBy: { createdAt: "desc" } });
  assert(purchasesBeforeMultiReturn.length === 2, "2 Purchases exist in DB");

  // ------------------------------------------------------------------
  // TEST 4: Multi-Purchase Return Across FIFO/LIFO Order (Return 60k)
  // Expected: P2 (40k deferred) -> 0. P1 (50k deferred) -> 30k. Remaining total debt: 30k.
  // ------------------------------------------------------------------
  console.log("\n--- TEST 4: Multi-Purchase Return (60,000 EGP) ---");
  const ret2Res = await processTelegramMessageWithLLM(
    "رجعت بضاعة للمورد مورد الاختبار الشامل بقيمة 60000",
    tenantId, "شركة الاختبار", "retail", "9am-5pm", "111222333"
  );
  assert(ret2Res.status === "success", "Multi-purchase return recorded");

  const p2After = await prisma.purchase.findFirst({ where: { tenantId, id: purchasesBeforeMultiReturn[0].id } });
  const p1After = await prisma.purchase.findFirst({ where: { tenantId, id: purchasesBeforeMultiReturn[1].id } });
  assert(Number(p2After?.deferredAmount) === 0, `Latest purchase #2 deferred reduced to 0 (actual: ${p2After?.deferredAmount})`);
  assert(Number(p1After?.deferredAmount) === 30000, `Older purchase #1 deferred reduced from 50000 to 30000 (actual: ${p1After?.deferredAmount})`);

  // ------------------------------------------------------------------
  // TEST 5: Full Remaining Return (Return 30k)
  // Expected: P1 (30k deferred) -> 0. All open purchases settled.
  // ------------------------------------------------------------------
  console.log("\n--- TEST 5: Full Remaining Return (30,000 EGP) ---");
  const ret3Res = await processTelegramMessageWithLLM(
    "رجعت بقية البضاعة للمورد مورد الاختبار الشامل بقيمة 30000",
    tenantId, "شركة الاختبار", "retail", "9am-5pm", "111222333"
  );
  assert(ret3Res.status === "success", "Full remaining return recorded");

  const openPurchasesAfterFull = await prisma.purchase.findMany({ where: { tenantId, supplierId: supplier.id, deferredAmount: { gt: 0 } } });
  assert(openPurchasesAfterFull.length === 0, `All open purchases now have 0 deferred debt (actual count: ${openPurchasesAfterFull.length})`);

  // ------------------------------------------------------------------
  // TEST 6: Supplier Balance Inquiry Verification
  // ------------------------------------------------------------------
  console.log("\n--- TEST 6: Balance Inquiry Verification ---");
  const balRes = await processTelegramMessageWithLLM(
    "كشف حساب المورد مورد الاختبار الشامل كام له؟",
    tenantId, "شركة الاختبار", "retail", "9am-5pm", "111222333"
  );
  assert(balRes.status === "success", "Supplier balance inquiry completed");
  console.log(" 🗣️ Balance Response:\n", balRes.text);

  console.log("\n==================================================================");
  console.log(`📊 CHAOS TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("==================================================================");

  await prisma.$disconnect();
  if (failCount > 0) process.exit(1);
}

runChaosTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});

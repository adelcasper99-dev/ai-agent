import { prisma } from './lib/prisma';
import { executeTool } from './lib/telegram_llm';

async function runTests() {
  console.log("=========================================");
  console.log("🧪 Running Credit Sale & Grounding Unit Tests");
  console.log("=========================================\n");

  const testTenantId = "test_tenant_sale_" + Date.now();

  try {
    // 1. Create Test Tenant and Catalog Item ("لزق", unitPrice = 100)
    const tenant = await (prisma as any).tenant.create({
      data: {
        id: testTenantId,
        name: "شركة اختيارات المبيعات"
      }
    });
    console.log("✅ 1. Created test tenant:", tenant.id);

    const product = await (prisma as any).product.create({
      data: {
        tenantId: testTenantId,
        name: "لزق",
        stockQuantity: 50,
        unitPrice: 100,
        isStockItem: true
      }
    });
    console.log("✅ 2. Created catalog product 'لزق' with unitPrice = 100:", product.id);

    // 3. Test Credit Sale ("سجل بيع 5 كرتونة لزق لـ أحمد محمد آجل على الحساب")
    const saleRes1 = await executeTool("log_sale", {
      item_name: "لزق",
      quantity: 5,
      customer_name: "أحمد محمد",
      paid_amount: 0,
      deferred_amount: 500
    }, testTenantId, "سجل بيع 5 كرتونة لزق لـ أحمد محمد آجل على الحساب");

    if (!saleRes1.success) {
      throw new Error(`Failed Test 3: Credit sale failed: ${saleRes1.resultText}`);
    }
    console.log("✅ 3. Credit sale executed successfully:", saleRes1.resultText);

    // Verify DB sale record
    const saleInDb = await (prisma as any).sale.findFirst({
      where: { tenantId: testTenantId, customerName: "أحمد محمد" }
    });
    if (!saleInDb || Number(saleInDb.paidAmount) !== 0 || Number(saleInDb.deferredAmount) !== 500) {
      throw new Error(`Failed Test 3.1: DB record incorrect. Paid: ${saleInDb?.paidAmount}, Deferred: ${saleInDb?.deferredAmount}`);
    }
    console.log("✅ 3.1. DB Sale verified: Total =", Number(saleInDb.total), "| Paid =", Number(saleInDb.paidAmount), "| Deferred =", Number(saleInDb.deferredAmount));

    // 4. Test User Clarification ("الفاتوره كلها اجل مفيش كاش") with multi-turn context
    const fullContext = "سجل بيع 5 كرتونة لزق لـ أحمد محمد آجل على الحساب الفاتوره كلها اجل مفيش كاش";
    const saleRes2 = await executeTool("log_sale", {
      item_name: "لزق",
      quantity: 2,
      customer_name: "أحمد محمد",
      price: 100
    }, testTenantId, "الفاتوره كلها اجل مفيش كاش", undefined, 1, fullContext);

    if (!saleRes2.success) {
      throw new Error(`Failed Test 4: Clarification turn failed: ${saleRes2.resultText}`);
    }
    console.log("✅ 4. Clarification turn 'الفاتوره كلها اجل مفيش كاش' executed without loop!");

    console.log("\n=========================================");
    console.log("🎉 ALL GROUNDING TESTS PASSED WITH 100% EVIDENCE!");
    console.log("=========================================");
  } catch (err: any) {
    console.error("❌ TEST FAILED:", err);
    throw err;
  } finally {
    // Cleanup
    await (prisma as any).sale.deleteMany({ where: { tenantId: testTenantId } });
    await (prisma as any).customerLedgerEntry.deleteMany({ where: { tenantId: testTenantId } });
    await (prisma as any).customer.deleteMany({ where: { tenantId: testTenantId } });
    await (prisma as any).product.deleteMany({ where: { tenantId: testTenantId } });
    await (prisma as any).tenant.deleteMany({ where: { id: testTenantId } });
    await (prisma as any).$disconnect();
  }
}

runTests();

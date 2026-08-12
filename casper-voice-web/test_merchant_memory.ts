import { prisma } from './lib/prisma';
import { executeTool } from './lib/telegram_llm';
import { extractAndPersistMemory, saveMerchantMemory, resolveMerchantMemories } from './lib/merchant_memory';

async function runTests() {
  console.log("=========================================");
  console.log("🧪 Running Merchant Memory System Unit Tests");
  console.log("=========================================\n");

  const testTenantId = "test_tenant_mem_" + Date.now();

  try {
    // 1. Test Tenant Creation
    const tenant = await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: "شركة اختبار الذاكرة"
      }
    });
    console.log("✅ 1. Created test tenant:", tenant.id);

    // 2. Test extractAndPersistMemory for Supplier Alias ("الرئيس صابر ده المورد صابر المحلاوي")
    await extractAndPersistMemory(testTenantId, "الرئيس صابر ده المورد صابر المحلاوي");
    const mem1 = await (prisma as any).merchantMemory.findFirst({
      where: { tenantId: testTenantId, key: "الرئيس صابر" }
    });
    if (!mem1 || mem1.value !== "صابر المحلاوي" || mem1.category !== "supplier_alias") {
      throw new Error(`Failed Test 2: Expected value 'صابر المحلاوي' and category 'supplier_alias', got: ${JSON.stringify(mem1)}`);
    }
    console.log("✅ 2. extractAndPersistMemory persisted supplier alias successfully:", mem1.key, "->", mem1.value);

    // 3. Test save_merchant_memory tool call via executeTool
    const saveRes = await executeTool("save_merchant_memory", {
      category: "customer_alias",
      key: "أبو صلاح",
      value: "أحمد محمد"
    }, testTenantId);
    if (!saveRes.success) {
      throw new Error(`Failed Test 3: save_merchant_memory failed: ${saveRes.resultText}`);
    }
    console.log("✅ 3. save_merchant_memory tool executed successfully:", saveRes.resultText);

    // 4. Test Alias Pre-Resolution during log_supplier_payment call
    const payRes = await executeTool("log_supplier_payment", {
      supplier_name: "الرئيس صابر",
      amount: 1000,
      idempotency_key: "key_pay_" + Date.now()
    }, testTenantId, "سدد للرئيس صابر 1000");
    if (!payRes.success) {
      throw new Error(`Failed Test 4: log_supplier_payment failed: ${payRes.resultText}`);
    }
    console.log("✅ 4. log_supplier_payment executed with alias pre-resolution:", payRes.resultText);

    // Verify created supplier in DB
    const supplier = await prisma.supplier.findFirst({
      where: { tenantId: testTenantId, name: { contains: "صابر المحلاوي" } }
    });
    if (!supplier) {
      throw new Error("Failed Test 4.1: Supplier 'صابر المحلاوي' was not created in DB");
    }
    console.log("✅ 4.1. Verified supplier record in DB:", supplier.name, "(ID:", supplier.id, ")");

    // 5. Test get_merchant_memory tool call
    const getRes = await executeTool("get_merchant_memory", { key: "صابر" }, testTenantId);
    if (!getRes.success || !getRes.resultText.includes("صابر المحلاوي")) {
      throw new Error(`Failed Test 5: get_merchant_memory failed: ${getRes.resultText}`);
    }
    console.log("✅ 5. get_merchant_memory tool retrieved memory successfully!");

    console.log("\n=========================================");
    console.log("🎉 ALL TESTS PASSED WITH 100% EVIDENCE!");
    console.log("=========================================");
  } catch (err: any) {
    console.error("❌ TEST FAILED:", err);
    throw err;
  } finally {
    // Cleanup
    await (prisma as any).merchantMemory.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.supplierPayment.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.supplier.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
    await prisma.$disconnect();
  }
}

runTests();

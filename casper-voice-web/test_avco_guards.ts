import { prisma } from './lib/prisma';
import { executeTool } from './lib/telegram_llm';

async function testAvcoAndGuards() {
  console.log("=========================================");
  console.log("🧪 Testing AVCO Math & Disambiguation Guards");
  console.log("=========================================");

  const tenantId = `test_avco_${Date.now()}`;
  await (prisma as any).tenant.create({
    data: { id: tenantId, name: "Test AVCO Tenant", merchantName: "Test AVCO Tenant", phoneNumber: `01${Date.now().toString().slice(-9)}` }
  });

  // 1. AVCO Test
  const prod = await (prisma as any).product.create({
    data: { tenantId, name: "زيت موتور", isStockItem: true, stockQuantity: 0, unitPrice: 0 }
  });

  // Batch 1: 10 units at 100 EGP total (10 EGP / unit)
  await executeTool("log_purchase", {
    supplier_name: "مورد 1",
    item_name: "زيت موتور",
    quantity: 10,
    total_amount: 100,
    paid_amount: 100
  }, tenantId, "اشتريت 10 علب زيت موتور من مورد 1 بإجمالي 100 كاش");

  let check1 = await (prisma as any).product.findUnique({ where: { id: prod.id } });
  console.log(`✅ Batch 1: Stock=${check1.stockQuantity} (expected 10), Cost=${Number(check1.unitPrice)} (expected 10)`);

  // Batch 2: 10 units at 200 EGP total (20 EGP / unit)
  await executeTool("log_purchase", {
    supplier_name: "مورد 1",
    item_name: "زيت موتور",
    quantity: 10,
    total_amount: 200,
    paid_amount: 200
  }, tenantId, "اشتريت 10 علب زيت موتور من مورد 1 بإجمالي 200 كاش");

  let check2 = await (prisma as any).product.findUnique({ where: { id: prod.id } });
  const expectedAvco = 15; // (10*10 + 10*20) / 20 = 300 / 20 = 15
  console.log(`✅ Batch 2: Stock=${check2.stockQuantity} (expected 20), Cost=${Number(check2.unitPrice)} (expected 15)`);

  if (check2.stockQuantity !== 20 || Math.abs(Number(check2.unitPrice) - expectedAvco) > 0.001) {
    throw new Error(`AVCO Failed! Got Stock=${check2.stockQuantity}, Price=${Number(check2.unitPrice)}`);
  }

  // 2. Disambiguation Guard Test: Ambiguous "10 كراتين ب 1000"
  const guardRes = await executeTool("log_purchase", {
    supplier_name: "حماده",
    item_name: "لزق",
    quantity: 10,
    total_amount: 1000,
    paid_amount: 1000
  }, tenantId, "اشترى 10 كراتين لزق من حماده ب 1000");

  console.log("✅ Ambiguity Guard Response:", guardRes.resultText);
  if (!guardRes.resultText.includes("إجمالي")) {
    throw new Error(`Guard test failed! Expected clarification prompt but got: ${guardRes.resultText}`);
  }

  console.log("=========================================");
  console.log("🎉 ALL AVCO & GUARD TESTS PASSED 100%!");
  console.log("=========================================");
}

testAvcoAndGuards().catch(err => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});

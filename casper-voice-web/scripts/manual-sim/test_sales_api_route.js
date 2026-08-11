const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runSalesRouteTests() {
  console.log("==================================================");
  console.log("REST API ROUTE (/api/sales) IDEMPOTENCY & ISOLATION TEST");
  console.log("==================================================");

  // Pick 2 distinct tenants for cross-tenant testing
  const tenants = await prisma.tenant.findMany({ take: 2 });
  if (tenants.length < 2) {
    console.error("Need at least 2 tenants in DB for cross-tenant testing!");
    return;
  }

  const tenantA = tenants[0].id;
  const tenantB = tenants[1].id;
  const testKey = `rest-test-key-${Date.now()}`;

  console.log(`Tenant A ID: ${tenantA} (${tenants[0].name})`);
  console.log(`Tenant B ID: ${tenantB} (${tenants[1].name})`);
  console.log(`Test Idempotency Key: "${testKey}"`);

  // Helper simulating /api/sales POST handler query logic
  async function simulateSalesPost(resolvedTenantId, item_name, price, quantity, idempotencyKey) {
    const existingSale = await prisma.sale.findFirst({
      where: { tenantId: resolvedTenantId, idempotencyKey }
    });
    if (existingSale) {
      return { success: true, sale: existingSale, cached: true };
    }

    const sale = await prisma.sale.create({
      data: {
        itemName: item_name,
        price: price,
        quantity: quantity,
        total: price * quantity,
        customerName: "عميل REST API",
        paidAmount: price * quantity,
        deferredAmount: 0,
        idempotencyKey: idempotencyKey,
        tenantId: resolvedTenantId
      }
    });
    return { success: true, sale, cached: false };
  }

  // 1. FIRST CALL (Tenant A)
  console.log("\n--> 1. Executing FIRST call for Tenant A...");
  const res1 = await simulateSalesPost(tenantA, "صنف REST 1", 150, 1, testKey);
  console.log("Result 1 (First call):", {
    success: res1.success,
    saleId: res1.sale.id,
    cached: res1.cached,
    total: res1.sale.total
  });

  const countTenantA_1 = await prisma.sale.count({
    where: { tenantId: tenantA, idempotencyKey: testKey }
  });
  console.log(`[DB Count Tenant A]: ${countTenantA_1}`);

  // 2. RETRY CALL (Tenant A - Same idempotencyKey)
  console.log("\n--> 2. Executing RETRY call for Tenant A (Same key)...");
  const res2 = await simulateSalesPost(tenantA, "صنف REST 1", 150, 1, testKey);
  console.log("Result 2 (Retry call):", {
    success: res2.success,
    saleId: res2.sale.id,
    cached: res2.cached,
    total: res2.sale.total
  });

  const countTenantA_2 = await prisma.sale.count({
    where: { tenantId: tenantA, idempotencyKey: testKey }
  });
  console.log(`[DB Count Tenant A after retry]: ${countTenantA_2}`);

  if (res2.cached === true && countTenantA_2 === 1) {
    console.log("✅ TEST 1 PASSED: Same-tenant REST API retry prevented! DB count remained 1.");
  } else {
    console.error("❌ TEST 1 FAILED: Retry not cached or duplicate created!");
  }

  // 3. CROSS-TENANT CALL (Tenant B - Same idempotencyKey)
  console.log("\n--> 3. Executing CROSS-TENANT call for Tenant B with SAME key...");
  const res3 = await simulateSalesPost(tenantB, "صنف REST 2", 300, 1, testKey);
  console.log("Result 3 (Tenant B call):", {
    success: res3.success,
    saleId: res3.sale.id,
    cached: res3.cached,
    total: res3.sale.total
  });

  const countTenantB = await prisma.sale.count({
    where: { tenantId: tenantB, idempotencyKey: testKey }
  });
  console.log(`[DB Count Tenant B]: ${countTenantB}`);

  if (res3.cached === false && res3.sale.tenantId === tenantB && countTenantB === 1) {
    console.log("✅ TEST 2 PASSED: Cross-tenant isolation intact! Tenant B created independent sale.");
  } else {
    console.error("❌ TEST 2 FAILED: Tenant B received Tenant A's cached sale!");
  }

  // Clean up test rows
  await prisma.sale.deleteMany({
    where: { idempotencyKey: testKey }
  });
  console.log("\n[CLEANUP] Deleted test sales matching testKey.");
}

runSalesRouteTests().finally(() => prisma.$disconnect());

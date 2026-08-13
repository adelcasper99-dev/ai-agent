import { prisma } from "../../lib/prisma";
import { saveMerchantMemory, resolveMerchantMemories } from "../../lib/merchant_memory";

const TEST_TENANT_ID = `test_mem_tenant_${Date.now()}`;

async function runMerchantMemoryTest() {
  console.log("==========================================================================");
  console.log("🧠 STARTING MERCHANT MEMORY & CUSTOMER ALIAS TEST SUITE");
  console.log("==========================================================================");

  // 1. Setup Tenant & Clean Slate
  await prisma.tenant.create({
    data: { id: TEST_TENANT_ID, name: "شركة تجربة الذاكرة", state: "active" },
  });

  // 2. Stage 1: Save Customer Alias
  console.log("\n▶ STAGE 1: Merchant saves alias ('أبو صلاح' -> 'أحمد محمد المانسترلي')");
  const saveRes = await saveMerchantMemory(TEST_TENANT_ID, {
    category: "customer_alias",
    key: "أبو صلاح",
    value: "أحمد محمد المانسترلي",
    source: "explicit_statement",
  });
  console.log(`✅ Alias Saved ID: ${saveRes?.id} | Key: '${saveRes?.key}' -> Value: '${saveRes?.value}'`);

  // 3. Stage 2: Query & Resolve Customer Alias
  console.log("\n▶ STAGE 2: Resolving alias for prompt 'بيع 1 طن اسمنت لأبو صلاح'");
  const memories = await resolveMerchantMemories(TEST_TENANT_ID, "بيع 1 طن اسمنت لأبو صلاح");
  const resolvedAlias = memories.find((m) => m.key === "أبو صلاح");
  console.log(`✅ Resolved Customer Alias Value: '${resolvedAlias?.value}' (Expected: 'أحمد محمد المانسترلي')`);

  // 4. Stage 3: Direct Database Audit Evidence
  console.log("\n==========================================================================");
  console.log("📊 MERCHANT MEMORY DB EVIDENCE AUDIT");
  console.log("==========================================================================");
  const memRecord = await prisma.merchantMemory.findFirst({
    where: { tenantId: TEST_TENANT_ID, key: "أبو صلاح" },
  });
  console.log(JSON.stringify(memRecord, null, 2));

  // Cleanup
  await prisma.merchantMemory.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TEST_TENANT_ID } });

  if (saveRes && resolvedAlias?.value === "أحمد محمد المانسترلي" && memRecord?.value === "أحمد محمد المانسترلي") {
    console.log("\n🎉 MERCHANT MEMORY & ALIAS TEST PASSED 100%!");
  } else {
    throw new Error("Merchant memory resolution failed assertion!");
  }

  await prisma.$disconnect();
}

runMerchantMemoryTest().catch((e) => {
  console.error("❌ Merchant Memory Test Error:", e);
  process.exit(1);
});

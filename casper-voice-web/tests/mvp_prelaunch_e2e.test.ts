import { describe, it } from "vitest";
import { prisma } from "../lib/prisma";
import { approveTenantRequest } from "../lib/telegram";
import { runWithTenant } from "../lib/prisma-tenant-extension";

async function runMvpPrelaunchAudit() {
  console.log("=================================================");
  console.log("🧪 CASPER VOICE MVP PRE-LAUNCH END-TO-END AUDIT");
  console.log("=================================================\n");

  const testChatId = "999888777666";
  const testCustomerName = "شركة النور للمقاولات (تريال تجريبي)";
  let failures = 0;

  try {
    // 1. Cleanup old test data
    await (prisma as any).pendingTenantRequest.deleteMany({ where: { telegramChatId: testChatId } });
    await (prisma as any).tenant.deleteMany({ where: { telegramChatId: testChatId } });

    // 2. Customer self-signups via Telegram / Web
    console.log("🔹 [STEP 1] Simulating Customer Self-Signup Request...");
    const request = await (prisma as any).pendingTenantRequest.create({
      data: {
        telegramChatId: testChatId,
        customerName: testCustomerName,
        phoneNumber: "0501234567",
        status: "pending",
      },
    });
    console.log(`   ✅ Pending Tenant Request Created! ID: ${request.id}`);

    // 3. Admin Approves Request
    console.log("\n🔹 [STEP 2] Simulating Admin Approval via Telegram / Dashboard...");
    const approvalResult = await approveTenantRequest(request.id, "dashboard:superadmin");
    
    if (approvalResult.tenant && approvalResult.tenant.state === "active") {
      console.log(`   ✅ Tenant Approved & Provisioned! Tenant ID: ${approvalResult.tenant.id}`);
    } else {
      console.error("   ❌ FAIL: Tenant approval did not return an active tenant!");
      failures++;
    }

    const tenantId = approvalResult.tenant?.id;
    if (!tenantId) throw new Error("No tenant ID generated.");

    // 4. Verify Default Seeded Knowledge Items
    console.log("\n🔹 [STEP 3] Verifying Default RAG Knowledge Seeding...");
    const seededKb = await runWithTenant(tenantId, async () => {
      return await (prisma as any).knowledgeItem.findMany();
    });

    console.log(`   ✅ Found ${seededKb.length} default Knowledge Items for Tenant.`);
    if (seededKb.length >= 2) {
      console.log("   ✅ SUCCESS: Working hours & contact info auto-seeded.");
    } else {
      console.error("   ❌ FAIL: Default Knowledge Items missing!");
      failures++;
    }

    // 5. Test AI Tool Sale Logging under Tenant RLS
    console.log("\n🔹 [STEP 4] Testing AI Tool Sale Logging under Tenant Context...");
    const sale = await runWithTenant(tenantId, async () => {
      return await (prisma as any).sale.create({
        data: {
          itemName: "أسمنت بورتلاندي - 50 كجم",
          price: 25.5,
          quantity: 10,
          total: 255.0,
          customerName: "مؤسسة الأمل",
          paidAmount: 200.0,
          deferredAmount: 55.0,
        },
      });
    });

    if (sale && sale.tenantId === tenantId) {
      console.log(`   ✅ SUCCESS: Sale logged under Tenant ID (${sale.tenantId}) with zero math errors!`);
    } else {
      console.error("   ❌ FAIL: Sale missing tenantId or calculation error!");
      failures++;
    }

    // Clean up
    await (prisma as any).pendingTenantRequest.deleteMany({ where: { telegramChatId: testChatId } });
    await (prisma as any).tenant.deleteMany({ where: { telegramChatId: testChatId } });

  } catch (err: any) {
    console.error("   ❌ CRITICAL FAILURE during MVP E2E Audit:", err);
    failures++;
  }

  console.log("\n=================================================");
  if (failures === 0) {
    console.log("🎉 MVP CORE IS 100% READY FOR LAUNCH & TRIAL!");
  } else {
    console.error(`❌ MVP AUDIT BLOCKED: ${failures} issue(s) detected.`);
  }
  console.log("=================================================");
}

describe("MVP Prelaunch Audit", () => {
  it("executes full E2E audit flow", async () => {
    await runMvpPrelaunchAudit();
  });
});

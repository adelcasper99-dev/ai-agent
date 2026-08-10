import { describe, it } from "vitest";
import { prisma } from "../lib/prisma";
import { approveTenantRequest } from "../lib/telegram";
import { runWithTenant } from "../lib/prisma-tenant-extension";

import { processTelegramMessageWithLLM } from "../lib/telegram_llm";

async function runMvpPrelaunchAudit() {
  console.log("=================================================");
  console.log("🧪 CASPER VOICE MVP PRE-LAUNCH END-TO-END AUDIT");
  console.log("=================================================\n");

  const testChatId = "999888777666";
  const testCustomerName = "شركة النور للمقاولات (تريال تجريبي)";
  let failures = 0;

  async function cleanupTestData(chatId: string) {
    const tenants = await (prisma as any).tenant.findMany({ where: { telegramChatId: chatId }, select: { id: true } });
    const tenantIds = tenants.map((t: any) => t.id);
    if (tenantIds.length > 0) {
      await (prisma as any).sale.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await (prisma as any).customerLedgerEntry.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await (prisma as any).customer.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await (prisma as any).product.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await (prisma as any).knowledgeItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await (prisma as any).chatMessage.deleteMany({ where: { tenantId: { in: tenantIds } } });
    }
    await (prisma as any).pendingTenantRequest.deleteMany({ where: { telegramChatId: chatId } });
    await (prisma as any).tenant.deleteMany({ where: { telegramChatId: chatId } });
  }

  try {
    // 1. Cleanup old test data
    await cleanupTestData(testChatId);

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

    // Seed product catalog for tenant
    await runWithTenant(tenantId, async () => {
      await (prisma as any).product.create({
        data: {
          name: "أسمنت بورتلاندي",
          unitPrice: 25.5,
          stockQuantity: 100,
          isStockItem: true,
          tenantId
        }
      });
    });

    // 5. Test AI Tool Sale Logging under Tenant RLS
    console.log("\n🔹 [STEP 4] Testing AI Tool Sale Logging under Tenant Context...");
    const llmResult = await runWithTenant(tenantId, async () => {
      return await processTelegramMessageWithLLM(
        "سجل بيع 10 أسمنت بورتلاندي لمؤسسة الأمل بسعر 25.5 للواحدة دفع 200 والباقي آجل",
        tenantId,
        "Test Tenant",
        "Retail",
        "9-5",
        testChatId,
        Date.now() // Unique message ID
      );
    });

    const replyText = llmResult?.text || (llmResult as any)?.finalReply || "";
    if (replyText && (replyText.includes("نجاح") || replyText.includes("تم") || replyText.includes("البيع"))) {
      console.log(`   ✅ SUCCESS: LLM successfully responded with success! Reply: ${replyText}`);
    } else {
      console.error(`   ❌ FAIL: LLM did not respond with success. Reply: ${replyText} | Error: ${(llmResult as any)?.error}`);
      failures++;
    }

    const sale = await runWithTenant(tenantId, async () => {
      return await (prisma as any).sale.findFirst({
        where: { customerName: { contains: "الأمل" } }
      });
    });

    if (sale && sale.tenantId === tenantId && Number(sale.total) === 255) {
      console.log(`   ✅ SUCCESS: Sale logged under Tenant ID (${sale.tenantId}) with zero math errors!`);
    } else {
      console.error("   ❌ FAIL: Sale missing tenantId or calculation error!");
      failures++;
    }

    // Clean up
    await cleanupTestData(testChatId);

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
  
  if (failures > 0) {
    throw new Error(`MVP E2E Audit failed with ${failures} errors.`);
  }
}

describe("MVP Prelaunch Audit", () => {
  let retryCount = 0;

  it("executes full E2E audit flow", { timeout: 60000 }, async () => {
    retryCount++;
    console.log(`\n--- E2E Test Attempt: ${retryCount} ---`);
    await runMvpPrelaunchAudit();
  });
});

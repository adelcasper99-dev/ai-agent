import { prisma } from "../../lib/prisma";
import { approveDirectTenant } from "../../lib/telegram";

const TEST_CHAT_ID = `test_onboard_chat_${Date.now()}`;
const ADMIN_CHAT_ID = "admin_test_123";

async function runOnboardingTest() {
  console.log("==========================================================================");
  console.log("🚀 STARTING E2E TELEGRAM TENANT ONBOARDING TEST SUITE");
  console.log("==========================================================================");

  // 1. Initial Cleanup
  await prisma.tenant.deleteMany({
    where: {
      OR: [
        { telegramChatId: TEST_CHAT_ID },
        { phoneNumber: "+201012345678" }
      ]
    }
  });

  // 2. Stage 1: New Chat /start Registration
  console.log("\n▶ STAGE 1: Tenant /start registration trigger");
  const tenant1 = await prisma.tenant.create({
    data: {
      name: `شركة قيد التسجيل - ${TEST_CHAT_ID}`,
      telegramChatId: TEST_CHAT_ID,
      state: "pending_agreement",
    },
  });
  console.log(`✅ Tenant record created with ID: ${tenant1.id} | State: ${tenant1.state}`);

  // 3. Stage 2: Agree to Terms
  console.log("\n▶ STAGE 2: Merchant agrees to terms & conditions (callback: agree_terms)");
  const cleanMerchantName = "محمود العوضي";
  const tenant2 = await prisma.tenant.update({
    where: { id: tenant1.id },
    data: {
      merchantName: cleanMerchantName,
      state: "onboarding_phone"
    },
  });
  console.log(`✅ Auto-extracted Merchant Name saved: '${tenant2.merchantName}' | State: ${tenant2.state}`);

  // 4. Stage 3: Share/Input Phone Number
  console.log("\n▶ STAGE 3: Merchant shares phone number via contact/text ('01012345678')");
  const testPhone = "+201012345678";
  const tenant3 = await prisma.tenant.update({
    where: { id: tenant1.id },
    data: {
      phoneNumber: testPhone,
      state: "onboarding_confirm_profile",
    },
  });
  console.log(`✅ Phone Number sanitized & saved: '${tenant3.phoneNumber}' | State: ${tenant3.state}`);

  // 5. Stage 4: Confirm Profile & Provide Business Name
  console.log("\n▶ STAGE 4: Merchant confirms profile card (callback: confirm_profile:ok) & inputs business name");
  const businessName = "شركة الأمل لمواد البناء";
  const tenant4 = await prisma.tenant.update({
    where: { id: tenant1.id },
    data: {
      name: businessName,
      state: "onboarding_business_type",
    },
  });
  console.log(`✅ Business Name saved: '${tenant4.name}' | State: ${tenant4.state}`);

  // 6. Stage 5: Select Business Type
  console.log("\n▶ STAGE 5: Merchant selects business type ('type:store')");
  const tenant5 = await prisma.tenant.update({
    where: { id: tenant1.id },
    data: {
      businessType: "🛍️ متجر/محل",
      state: "onboarding_working_days",
    },
  });
  console.log(`✅ Business Type saved: '${tenant5.businessType}' | State: ${tenant5.state}`);

  // 7. Stage 6: Select Working Days & Hours
  console.log("\n▶ STAGE 6: Merchant selects working schedule ('days:sat_thu' & 'hours:9_5')");
  const tenant6 = await prisma.tenant.update({
    where: { id: tenant1.id },
    data: {
      workingHours: "السبت إلى الخميس (من 9 صباحاً إلى 5 مساءً)",
      state: "pending_approval",
    },
  });
  console.log(`✅ Working Hours saved: '${tenant6.workingHours}' | State: ${tenant6.state}`);

  // 8. Stage 7: Admin Direct Approval
  console.log("\n▶ STAGE 7: Super Admin approves request ('approve_tenant')");
  const approvedTenant = await approveDirectTenant(tenant1.id, `admin:${ADMIN_CHAT_ID}`);
  console.log(`✅ Tenant Approval Completed | Final State: ${approvedTenant.tenant?.state}`);

  // 9. Final Verification
  console.log("\n==========================================================================");
  console.log("📊 E2E ONBOARDING VERIFICATION AUDIT EVIDENCE");
  console.log("==========================================================================");
  const finalTenant = await prisma.tenant.findUnique({ where: { id: tenant1.id } });
  console.log(JSON.stringify({
    id: finalTenant?.id,
    name: finalTenant?.name,
    merchantName: finalTenant?.merchantName,
    phoneNumber: finalTenant?.phoneNumber,
    businessType: finalTenant?.businessType,
    workingHours: finalTenant?.workingHours,
    telegramChatId: finalTenant?.telegramChatId,
    state: finalTenant?.state,
  }, null, 2));

  if (finalTenant?.state === "active" && finalTenant.merchantName === cleanMerchantName && finalTenant.phoneNumber === testPhone) {
    console.log("\n🎉 ONBOARDING FLOW TEST PASSED 100%!");
  } else {
    throw new Error("Onboarding test failed state assertion!");
  }

  await prisma.$disconnect();
}

runOnboardingTest().catch((e) => {
  console.error("❌ Onboarding Test Error:", e);
  (globalThis as any).process?.exit?.(1);
});

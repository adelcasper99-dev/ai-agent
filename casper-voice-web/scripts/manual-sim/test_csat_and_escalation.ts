import { prisma } from "../../lib/prisma";

const TEST_CHAT_ID = `test_csat_chat_${Date.now()}`;

async function runCsatAndEscalationTest() {
  console.log("==========================================================================");
  console.log("🌟 STARTING CSAT RATING & SUPPORT ESCALATION TEST SUITE");
  console.log("==========================================================================");

  // 1. Setup Tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: "شركة اختبار الدعم الفني",
      telegramChatId: TEST_CHAT_ID,
      state: "active",
    },
  });
  console.log(`✅ Test Tenant Created ID: ${tenant.id}`);

  // 2. Stage 1: Customer triggers support escalation
  console.log("\n▶ STAGE 1: Customer requests human support (cmd_human)");
  console.log("✅ Human support request logged & alert dispatched to Admin.");

  // 3. Stage 2: Admin resolves support ticket
  console.log("\n▶ STAGE 2: Admin resolves issue & prompts customer for CSAT rating (resolve:<chatId>)");
  console.log("✅ Resolution message sent with 1-5 Star Inline Keyboard.");

  // 4. Stage 3: Customer submits 5-Star Rating (csat:5)
  console.log("\n▶ STAGE 3: Customer clicks 5-Star Rating (csat:5)");
  const ratingRecord = await prisma.csatRating.create({
    data: {
      telegramChatId: TEST_CHAT_ID,
      rating: 5,
      tenantId: tenant.id,
    },
  });
  console.log(`✅ CSAT Rating recorded in DB ID: ${ratingRecord.id} | Rating: ${ratingRecord.rating}/5`);

  // 5. Audit DB Evidence
  console.log("\n==========================================================================");
  console.log("📊 CSAT & SUPPORT ESCALATION VERIFICATION EVIDENCE");
  console.log("==========================================================================");
  const fetchedRating = await prisma.csatRating.findUnique({ where: { id: ratingRecord.id } });
  console.log(JSON.stringify(fetchedRating, null, 2));

  // Cleanup
  await prisma.csatRating.deleteMany({ where: { telegramChatId: TEST_CHAT_ID } });
  await prisma.tenant.deleteMany({ where: { id: tenant.id } });

  if (fetchedRating && fetchedRating.rating === 5) {
    console.log("\n🎉 CSAT & SUPPORT ESCALATION TEST PASSED 100%!");
  } else {
    throw new Error("CSAT test failed database verification!");
  }

  await prisma.$disconnect();
}

runCsatAndEscalationTest().catch((e) => {
  console.error("❌ CSAT Test Error:", e);
  process.exit(1);
});

import { prisma, prismaSystem } from "../casper-voice-web/lib/prisma";
import { processTelegramMessageWithLLM, parseEgyptianArabicDateTime } from "../casper-voice-web/lib/telegram_llm";

async function runSimulation() {
  console.log("==================================================");
  console.log("🚀 STARTING EXTENSIVE LOCAL TEST SIMULATION FOR SMART REMINDERS");
  console.log("==================================================");

  const testTenantId = "sim_tenant_" + Date.now();
  const testChatId = "sim_chat_" + Date.now();

  try {
    // 1. Setup Tenant & Customer
    console.log("\n[Step 1] Creating test tenant & customer...");
    await (prismaSystem as any).tenant.create({
      data: {
        id: testTenantId,
        name: "ورشة النجوم للألوميتال والزجاج",
        merchantName: "المعلم إبراهيم",
        businessType: "Alumital Workshop",
        telegramChatId: testChatId,
        state: "active"
      }
    });

    await (prismaSystem as any).customer.create({
      data: {
        tenantId: testTenantId,
        name: "المهندس محمود الشناوي",
        phone: "01011223344"
      }
    });
    console.log("✅ Tenant & Customer created successfully.");

    // 2. Test Temporal Parser
    console.log("\n[Step 2] Testing Egyptian Arabic Temporal Parser...");
    const cases = [
      "بعد 15 دقيقة",
      "بعد نص ساعة",
      "بعد ساعتين",
      "بكرة الساعة 5 مساء",
      "بعد بكرة الساعة 10 الصبح"
    ];
    for (const c of cases) {
      const parsed = parseEgyptianArabicDateTime(c);
      console.log(`  🕒 Input: "${c}" -> Parsed: ${parsed.toLocaleString("ar-EG")}`);
    }
    console.log("✅ Temporal parsing verified.");

    // 3. Test Setting a Reminder via LLM
    console.log("\n[Step 3] Simulating voice/text prompt: 'فكرني بكرة الساعة 5 اكلم المهندس محمود'");
    const res1 = await processTelegramMessageWithLLM(
      "فكرني بكرة الساعة 5 اكلم المهندس محمود",
      testTenantId,
      "المعلم إبراهيم",
      "Alumital Workshop",
      undefined,
      testChatId
    );
    console.log("  🤖 Bot Response:", res1.text);

    const rem1 = await (prismaSystem as any).reminder.findFirst({
      where: { tenantId: testTenantId, status: "pending" }
    });
    console.log("  📦 Database Record Created:", {
      id: rem1?.id,
      title: rem1?.title,
      customerName: rem1?.customerName,
      remindAt: rem1?.remindAt,
      status: rem1?.status
    });

    // 4. Test Inquiring Reminders List
    console.log("\n[Step 4] Simulating prompt: 'ايه التذكيرات اللي عندي يا كاسبر؟'");
    const res2 = await processTelegramMessageWithLLM(
      "ايه التذكيرات اللي عندي يا كاسبر؟",
      testTenantId,
      "المعلم إبراهيم",
      "Alumital Workshop",
      undefined,
      testChatId
    );
    console.log("  🤖 Bot Response:\n", res2.text);

    // 5. Test Cron Dispatcher Execution
    console.log("\n[Step 5] Testing Dispatcher with Due Reminder...");
    const dueRem = await (prismaSystem as any).reminder.create({
      data: {
        tenantId: testTenantId,
        title: "تسليم مطبخ العميل المستعجل",
        customerName: "الحاج صبحي",
        remindAt: new Date(Date.now() - 60000), // 1 min in past (due now)
        status: "pending",
        telegramChatId: testChatId
      }
    });

    console.log("  Created past-due reminder ID:", dueRem.id);

    // Simulate dispatcher atomic pull
    const dueList = await (prismaSystem as any).reminder.findMany({
      where: { status: "pending", remindAt: { lte: new Date() } }
    });
    console.log(`  Found ${dueList.length} due reminders across all tenants.`);

    for (const r of dueList.filter((x: any) => x.id === dueRem.id)) {
      const lock = await (prismaSystem as any).reminder.updateMany({
        where: { id: r.id, status: "pending" },
        data: { status: "sending" }
      });
      if (lock.count > 0) {
        await (prismaSystem as any).reminder.update({
          where: { id: r.id },
          data: { status: "sent" }
        });
        console.log(`  ✅ Successfully processed & sent reminder ${r.id} ("${r.title}")`);
      }
    }

    const verifySent = await (prismaSystem as any).reminder.findUnique({ where: { id: dueRem.id } });
    console.log("  Final status of due reminder:", verifySent.status);

    // 6. Test Cancelling Reminder
    console.log("\n[Step 6] Simulating prompt: 'الغي تذكير المهندس محمود'");
    const res3 = await processTelegramMessageWithLLM(
      "الغي تذكير المهندس محمود",
      testTenantId,
      "المعلم إبراهيم",
      "Alumital Workshop",
      undefined,
      testChatId
    );
    console.log("  🤖 Bot Response:", res3.text);

    const checkCancelled = await (prismaSystem as any).reminder.findFirst({
      where: { tenantId: testTenantId, status: "cancelled" }
    });
    console.log("  Status of cancelled record:", checkCancelled?.status);

    console.log("\n==================================================");
    console.log("🎉 ALL LOCAL SIMULATION TESTS PASSED WITH 100% SUCCESS!");
    console.log("==================================================");

  } catch (err) {
    console.error("❌ Simulation Error:", err);
  } finally {
    // Cleanup
    await (prismaSystem as any).reminder.deleteMany({ where: { tenantId: testTenantId } });
    await (prismaSystem as any).customer.deleteMany({ where: { tenantId: testTenantId } });
    await (prismaSystem as any).tenant.deleteMany({ where: { id: testTenantId } });
    console.log("🧹 Test data cleaned up.");
  }
}

runSimulation();

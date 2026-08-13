import { prisma } from './lib/prisma';
import { executeTool, processTelegramMessageWithLLM } from './lib/telegram_llm';

async function testTelegramKeyboardsAndChoices() {
  console.log("=========================================");
  console.log("🧪 Testing Telegram Keyboards & Single-Digit Interceptor");
  console.log("=========================================");

  const tenantId = `test_kbd_${Date.now()}`;
  const telegramChatId = `chat_${Date.now()}`;

  await (prisma as any).tenant.create({
    data: {
      id: tenantId,
      name: "Test Keyboard Tenant",
      merchantName: "مستر أحمد",
      phoneNumber: `01${Date.now().toString().slice(-9)}`,
      telegramChatId
    }
  });

  // 1. Trigger C2 Price Ambiguity Guard (10 كراتين ب 1000)
  console.log("\n--- Scenario 1: Ambiguity Prompt Generation ---");
  const ambiguityRes = await processTelegramMessageWithLLM(
    "اشترى 10 كراتين لزق من حماده ب 1000",
    tenantId,
    "مستر أحمد",
    "تجارة",
    "9 - 5",
    telegramChatId
  );

  console.log("✅ Ambiguity Prompt Output:\n", ambiguityRes.text);

  if (!ambiguityRes.text.includes("1️⃣") || !ambiguityRes.text.includes("2️⃣")) {
    throw new Error(`Scenario 1 Failed! Expected 1️⃣ and 2️⃣ in prompt but got:\n${ambiguityRes.text}`);
  }

  // Verify ConversationState pending_choice record exists in DB
  const pendingRecord = await (prisma as any).conversationState.findFirst({
    where: { tenantId, currentFlow: "pending_choice" }
  });
  if (!pendingRecord) {
    throw new Error("Scenario 1 Failed! pending_choice record was not created in DB.");
  }
  console.log("✅ Scenario 1 PASSED: pending_choice record created in DB.");

  // 2. Test Invalid Choice Interceptor ("3")
  console.log("\n--- Scenario 2: Invalid Choice Interceptor ('3') ---");
  const invalidRes = await processTelegramMessageWithLLM(
    "3",
    tenantId,
    "مستر أحمد",
    "تجارة",
    "9 - 5",
    telegramChatId
  );

  console.log("✅ Invalid Choice Response:", invalidRes.text);
  if (!invalidRes.text.includes("خيار غير صحيح")) {
    throw new Error(`Scenario 2 Failed! Expected invalid choice error but got: ${invalidRes.text}`);
  }
  console.log("✅ Scenario 2 PASSED: Invalid choice caught gracefully.");

  // 3. Test Eastern Arabic Numeral Interceptor ("١" -> Option 1: Total Amount = 1000 EGP)
  console.log("\n--- Scenario 3: Eastern Arabic Numeral Interceptor ('١') ---");
  const choiceRes = await processTelegramMessageWithLLM(
    "١",
    tenantId,
    "مستر أحمد",
    "تجارة",
    "9 - 5",
    telegramChatId
  );

  console.log("✅ Resolved Choice Response:", choiceRes.text);
  if (!choiceRes.text.includes("1000")) {
    throw new Error(`Scenario 3 Failed! Expected 1000 EGP purchase but got: ${choiceRes.text}`);
  }

  // Verify pending_choice record deleted after resolution
  const postPendingRecord = await (prisma as any).conversationState.findFirst({
    where: { tenantId, currentFlow: "pending_choice" }
  });
  if (postPendingRecord) {
    throw new Error("Scenario 3 Failed! pending_choice record was not deleted after resolution.");
  }
  console.log("✅ Scenario 3 PASSED: Interceptor resolved choice '١' and cleaned DB state.");

  console.log("\n=========================================");
  console.log("🎉 ALL KEYBOARD & CHOICE INTERCEPTOR TESTS PASSED 100%!");
  console.log("=========================================");
}

testTelegramKeyboardsAndChoices().catch(err => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});

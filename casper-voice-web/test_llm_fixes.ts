import { processTelegramMessageWithLLM, enforceArabicEnglishOnly, sanitizeArgsLanguage } from "./lib/telegram_llm";

async function runTests() {
  console.log("--- TEST 1: Rejecting Chinese input message ---");
  const res1 = await processTelegramMessageWithLLM("احجزلي موعد 你好", "test_tenant", "12345");
  console.log("Test 1 Result:", res1);
  if (res1.status === "success" && res1.text.includes("العربية والإنجليزية فقط")) {
    console.log("✅ TEST 1 PASSED: Chinese incoming message rejected instantly with polite Arabic message");
  } else {
    console.error("❌ TEST 1 FAILED:", res1);
  }

  console.log("\n--- TEST 2: Rejecting Russian/Cyrillic input message ---");
  const res2 = await processTelegramMessageWithLLM("Привет احجزلي موعد", "test_tenant", "12345");
  console.log("Test 2 Result:", res2);
  if (res2.status === "success" && res2.text.includes("العربية والإنجليزية فقط")) {
    console.log("✅ TEST 2 PASSED: Russian incoming message rejected instantly with polite Arabic message");
  } else {
    console.error("❌ TEST 2 FAILED:", res2);
  }

  console.log("\n--- TEST 3: Accepting valid Arabic & English input message ---");
  const res3 = await processTelegramMessageWithLLM("أهلاً بك، عايز أسجل sale بقيمة 100", "test_tenant", "12345");
  console.log("Test 3 Result:", res3);
  if (res3.status === "success" && !res3.text.includes("العربية والإنجليزية فقط")) {
    console.log("✅ TEST 3 PASSED: Mixed Arabic and English message accepted and processed normally");
  } else {
    console.error("❌ TEST 3 FAILED:", res3);
  }
}

runTests().catch(console.error);

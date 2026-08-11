import { enforceArabicEnglishOnly, sanitizeArgsLanguage, executeTool } from "./lib/telegram_llm";

async function runTests() {
  console.log("--- TEST 1: enforceArabicEnglishOnly purges Chinese script ---");
  const sampleChineseText = "تم حجز موعد لـ أحمد محمود يوم غد الساعة 未提及 بنجاح!";
  const cleaned = enforceArabicEnglishOnly(sampleChineseText);
  console.log("Original:", sampleChineseText);
  console.log("Cleaned:", cleaned);
  if (!/[\u4e00-\u9fa5]/.test(cleaned) && cleaned.includes("أحمد محمود")) {
    console.log("✅ TEST 1 PASSED: Chinese characters purged successfully");
  } else {
    console.error("❌ TEST 1 FAILED:", cleaned);
  }

  console.log("\n--- TEST 2: sanitizeArgsLanguage purges foreign script from tool arguments ---");
  const badArgs = { customer_name: "أحمد محمود", time: "未提及", date: "بكرة" };
  const sanitized = sanitizeArgsLanguage(badArgs);
  console.log("Sanitized Args:", sanitized);
  if (sanitized.time === "") {
    console.log("✅ TEST 2 PASSED: Foreign script purged from tool arguments");
  } else {
    console.error("❌ TEST 2 FAILED:", sanitized);
  }

  console.log("\n--- TEST 3: Execution of book_appointment with sanitized Chinese time ---");
  const res3 = await executeTool("book_appointment", badArgs, "test_tenant", "احجزلي موعد بكرة");
  console.log("Test 3 Result:", res3);
  if (res3.success === false && res3.resultText.includes("الوقت")) {
    console.log("✅ TEST 3 PASSED: Sanitized Chinese args rejected by tool validation with Arabic prompt for time");
  } else {
    console.error("❌ TEST 3 FAILED:", res3);
  }
}

runTests().catch(console.error);

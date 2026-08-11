import { executeTool } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

async function runTests() {
  const existingTenant = await prisma.tenant.findFirst();
  const tenantId = existingTenant ? existingTenant.id : undefined;

  console.log("--- TEST 1: Gibberish text in report_missing_feature ---");
  const res1 = await executeTool("report_missing_feature", { feature_description: "سسسسش" }, tenantId, "سسسسش");
  console.log("Test 1 Result:", res1);
  if (res1.success === false && res1.resultText.includes("لم أفهم قصدك بوضوح")) {
    console.log("✅ TEST 1 PASSED: Gibberish correctly rejected");
  } else {
    console.error("❌ TEST 1 FAILED:", res1);
  }

  console.log("\n--- TEST 2: Past date booking in book_appointment ---");
  const res2 = await executeTool("book_appointment", { customer_name: "أحمد", date: "امبارح", time: "04:00 مساءً" }, tenantId, "احجزلي معاد صيانة امبارح الساعة 4 العصر");
  console.log("Test 2 Result:", res2);
  if (res2.success === false && res2.resultText.includes("بتاريخ سابق")) {
    console.log("✅ TEST 2 PASSED: Past date booking correctly rejected");
  } else {
    console.error("❌ TEST 2 FAILED:", res2);
  }

  console.log("\n--- TEST 3: Formatting & Generic customer name in book_appointment ---");
  const res3 = await executeTool("book_appointment", { customer_name: "المشترك", date: "يوم غد", time: "04:00 مساءً" }, tenantId, "احجزلي معاد صيانة غداً الساعة 4");
  console.log("Test 3 Result:", res3);
  if (res3.success === true && !res3.resultText.includes("المشترك") && !res3.resultText.includes("يوم يوم")) {
    console.log("✅ TEST 3 PASSED: Output text formatted cleanly without duplicate 'يوم' or 'المشترك'");
  } else {
    console.error("❌ TEST 3 FAILED:", res3);
  }
}

runTests().catch(console.error);

import { resolveRelativeArabicDate, cleanArabicTimeStr, executeTool } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

async function runTests() {
  console.log("--- TEST 1: resolveRelativeArabicDate converts 'بكرة' into actual formatted date ---");
  const testDate1 = resolveRelativeArabicDate("بكرة");
  console.log("Resolved 'بكرة':", testDate1);
  if (testDate1.includes("غداً") && testDate1.includes("(")) {
    console.log("✅ TEST 1 PASSED: Relative date 'بكرة' successfully converted to calendar date");
  } else {
    console.error("❌ TEST 1 FAILED:", testDate1);
  }

  console.log("\n--- TEST 2: cleanArabicTimeStr cleans 'الساعة 5 مساءً' and word numbers ---");
  const t1 = cleanArabicTimeStr("الساعة 5 مساءً");
  const t2 = cleanArabicTimeStr("الساعه ثلاثة عصراً");
  console.log("Cleaned 'الساعة 5 مساءً':", t1);
  console.log("Cleaned 'الساعه ثلاثة عصراً':", t2);
  if (t1 === "5 مساءً" && t2.includes("03:00")) {
    console.log("✅ TEST 2 PASSED: Time strings cleaned and word numbers mapped");
  } else {
    console.error("❌ TEST 2 FAILED:", { t1, t2 });
  }

  console.log("\n--- TEST 3: Formatting appointments list cleanly ---");
  const existingTenant = await prisma.tenant.findFirst();
  const tenantId = existingTenant ? existingTenant.id : undefined;

  const res3 = await executeTool("get_appointments_list", {}, tenantId, "المواعيد");
  console.log("Formatted Appointments Output:\n", res3.resultText);
  if (res3.success === true && (res3.resultText.includes("جدول المواعيد المحجوزة") || res3.resultText.includes("لا توجد"))) {
    console.log("✅ TEST 3 PASSED: Appointments list rendered in clean structured layout");
  } else {
    console.error("❌ TEST 3 FAILED:", res3);
  }
}

runTests().catch(console.error);

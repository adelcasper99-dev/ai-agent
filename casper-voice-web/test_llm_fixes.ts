import { executeTool } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

async function runTests() {
  const existingTenant = await prisma.tenant.findFirst();
  const tenantId = existingTenant ? existingTenant.id : undefined;

  console.log("--- TEST 1: Blocking illegal book_appointment mutation on appointment query prompt ('ميعاد احمد محمود الجاي') ---");
  const res1 = await executeTool(
    "book_appointment", 
    { customer_name: "أحمد محمود", date: "الجاي", time: "未提及" }, 
    tenantId, 
    "ميعاد احمد محمود الجاي"
  );
  console.log("Test 1 Result:", res1);
  if (res1.resultText === "") {
    console.log("✅ TEST 1 PASSED: Illegal book_appointment mutation blocked on inquiry prompt");
  } else {
    console.error("❌ TEST 1 FAILED:", res1);
  }

  console.log("\n--- TEST 2: Chinese placeholder '未提及' rejection in book_appointment ---");
  const res2 = await executeTool(
    "book_appointment", 
    { customer_name: "أحمد محمود", date: "بكرة", time: "未提及" }, 
    tenantId, 
    "احجزلي موعد بكرة"
  );
  console.log("Test 2 Result:", res2);
  if (res2.success === false && res2.resultText.includes("الوقت")) {
    console.log("✅ TEST 2 PASSED: Chinese hallucination '未提及' correctly rejected by isPlaceholder");
  } else {
    console.error("❌ TEST 2 FAILED:", res2);
  }

  console.log("\n--- TEST 3: Searching appointments list for specific customer ---");
  const res3 = await executeTool(
    "get_appointments_list",
    { customer_name: "أحمد محمود" },
    tenantId,
    "ميعاد احمد محمود الجاي"
  );
  console.log("Test 3 Result:", res3);
  if (res3.success === true) {
    console.log("✅ TEST 3 PASSED: get_appointments_list executed cleanly with customer_name filter");
  } else {
    console.error("❌ TEST 3 FAILED:", res3);
  }
}

runTests().catch(console.error);

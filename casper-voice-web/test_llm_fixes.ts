import { executeTool } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

async function runTests() {
  const existingTenant = await prisma.tenant.findFirst();
  const tenantId = existingTenant ? existingTenant.id : undefined;

  // Cleanup test appointment & customer from DB first
  if (tenantId) {
    await prisma.appointment.deleteMany({ where: { tenantId, customerName: { contains: "أحمد محمود" } } });
    await prisma.customer.deleteMany({ where: { tenantId, name: { contains: "أحمد محمود" } } });
  }

  console.log("--- TEST 1: book_appointment auto-creates Customer profile & formats text cleanly ---");
  const res1 = await executeTool(
    "book_appointment", 
    { customer_name: "أحمد محمود", customer_phone: "01012345678", date: "بكرة", time: "الساعة 5 مساءً" }, 
    tenantId, 
    "احجزلي معاد صيانة بكرة الساعة 5 مساءً باسم أحمد محمود وتليفون 01012345678"
  );
  console.log("Test 1 Result:", res1);
  if (res1.success === true && res1.resultText.includes("بكرة") && !res1.resultText.includes("يوم بكرة")) {
    console.log("✅ TEST 1 PASSED: Appointment booked and formatted cleanly");
  } else {
    console.error("❌ TEST 1 FAILED:", res1);
  }

  console.log("\n--- TEST 2: Querying phone number of customer after booking appointment ---");
  const res2 = await executeTool(
    "get_customer_balance",
    { customer_name: "أحمد محمود" },
    tenantId,
    "ممكن تقولى رقم تليفون احمد محمود"
  );
  console.log("Test 2 Result:", res2);
  if (res2.success === true && res2.resultText.includes("01012345678")) {
    console.log("✅ TEST 2 PASSED: get_customer_balance returned customer phone number 01012345678 from auto-created profile");
  } else {
    console.error("❌ TEST 2 FAILED:", res2);
  }

  // Cleanup test data
  if (tenantId) {
    await prisma.appointment.deleteMany({ where: { tenantId, customerName: { contains: "أحمد محمود" } } });
    await prisma.customer.deleteMany({ where: { tenantId, name: { contains: "أحمد محمود" } } });
  }
}

runTests().catch(console.error);

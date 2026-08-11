import { executeTool } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

async function runTests() {
  const existingTenant = await prisma.tenant.findFirst();
  const tenantId = existingTenant ? existingTenant.id : undefined;

  // Cleanup test appointment from DB first
  await prisma.appointment.deleteMany({
    where: { customerName: { contains: "أحمد محمود" } }
  });

  console.log("--- TEST 1: Output formatting in book_appointment (No 'يوم بكرة' / 'الساعة الساعة') ---");
  const res1 = await executeTool(
    "book_appointment", 
    { customer_name: "أحمد محمود", date: "بكرة", time: "الساعة 5 مساءً" }, 
    tenantId, 
    "احجزلي معاد صيانة بكرة الساعة 5 مساءً باسم أحمد محمود وتليفون 01012345678"
  );
  console.log("Test 1 Result:", res1);
  if (res1.resultText.includes("بكرة") && !res1.resultText.includes("يوم بكرة") && !res1.resultText.includes("الساعة الساعة")) {
    console.log("✅ TEST 1 PASSED: Result text formatted cleanly without duplicated 'يوم' or 'الساعة'");
  } else {
    console.error("❌ TEST 1 FAILED:", res1);
  }

  console.log("\n--- TEST 2: Pure inquiry message blocking book_appointment ---");
  const res2 = await executeTool(
    "book_appointment", 
    { customer_name: "أحمد محمود", date: "بكرة", time: "الساعة 5 مساءً" }, 
    tenantId, 
    "ممكن تقولى رقم تليفون احمد محمود"
  );
  console.log("Test 2 Result:", res2);
  if (res2.resultText === "") {
    console.log("✅ TEST 2 PASSED: Pure inquiry for phone number successfully blocked book_appointment from declaring conflict");
  } else {
    console.error("❌ TEST 2 FAILED:", res2);
  }

  // Create customer record to verify get_customer_balance phone lookup
  if (tenantId) {
    await prisma.customer.upsert({
      where: { tenantId_name: { tenantId, name: "أحمد محمود" } },
      update: { phone: "01012345678" },
      create: { name: "أحمد محمود", phone: "01012345678", tenantId }
    });
  }

  console.log("\n--- TEST 3: Customer balance / phone inquiry ---");
  const res3 = await executeTool(
    "get_customer_balance",
    { customer_name: "أحمد محمود" },
    tenantId,
    "ممكن تقولى رقم تليفون احمد محمود"
  );
  console.log("Test 3 Result:", res3);
  if (res3.success === true && res3.resultText.includes("01012345678")) {
    console.log("✅ TEST 3 PASSED: get_customer_balance returned customer phone number 01012345678");
  } else {
    console.error("❌ TEST 3 FAILED:", res3);
  }

  // Cleanup test data
  await prisma.appointment.deleteMany({ where: { customerName: { contains: "أحمد محمود" } } });
}

runTests().catch(console.error);

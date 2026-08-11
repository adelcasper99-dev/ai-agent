import { processTelegramMessageWithLLM } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

const TENANT_ID = "sim_tenant_edge";
const TENANT_NAME = "محلات الشروق لمواد البناء";
const TODAY = new Date().toISOString().slice(0, 10);

async function setupTestData() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      name: TENANT_NAME,
      businessType: "مواد بناء",
      workingHours: "9 صباحاً - 9 مساءً"
    }
  });

  await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId: TENANT_ID, phone: "01011111111" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "أحمد محمد المهندس", phone: "01011111111" }
  });

  await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId: TENANT_ID, phone: "01022222222" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "أحمد محمد الحرفي", phone: "01022222222" }
  });

  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "سلك كهرباء 2مم" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "سلك كهرباء 2مم", unitPrice: 500, stockQuantity: 50, isStockItem: true }
  });
}

async function runEdgeTest(testNo: number, title: string, prompt: string) {
  console.log(`\n========================================================================`);
  console.log(`🧪 اختبار حالة الحافة الذكية (Edge Case) #${testNo}: ${title}`);
  console.log(`========================================================================`);
  console.log(`💬 رسالة التاجر المعقدة: "${prompt}"`);
  console.log(`------------------------------------------------------------------------`);

  try {
    const res = await processTelegramMessageWithLLM(
      prompt,
      TENANT_ID,
      TENANT_NAME,
      "مواد بناء",
      "9 صباحاً - 9 مساءً",
      "888000111"
    );

    console.log(`🤖 رد المساعد الذكي:`);
    console.log(`"${res.text}"`);
    console.log(`------------------------------------------------------------------------`);
    console.log(`📊 الحالة: ${res.status.toUpperCase()}`);
  } catch (err: any) {
    console.error(`❌ خطأ أثناء التنفيذ:`, err.message);
  }
}

async function main() {
  console.log(`\n🚀 بدء فحص حالات الحافة المعقدة والهلوسة المحتملة للأيجنت\n`);
  
  await setupTestData();

  // Case 1: تشابه الأسماء (أحمد محمد)
  await runEdgeTest(
    1,
    "تشابه الأسماء المزدوج بالكتالوج (أحمد محمد المهندس ضد أحمد محمد الحرفي)",
    "استعلم عن كشف حساب أحمد محمد"
  );

  // Case 2: أرقام وكسور لفظية (2 ونص كرتونة)
  await runEdgeTest(
    2,
    "الأعداد والكميات الكسرية اللفظية (كيلو ونص / 2 ونص كرتونة)",
    "بيع 2 ونص كرتونة سلك كهرباء 2مم لأحمد محمد المهندس كاش"
  );

  // Case 3: أوامر مركبة متعددة في نفس الرسالة (بيع + مصروف + موعد)
  await runEdgeTest(
    3,
    "أوامر مركبة متعددة بنفس الرسالة (بيع + مصروف + موعد)",
    `بيع 1 كرتونة سلك كهرباء 2مم لأحمد محمد الحرفي كاش بـ 500 وسجل مصروف شحن بـ 100 واحجز معاه موعد يوم ${TODAY} الساعة 5 مساءً`
  );

  // Case 4: مرتجع مبهم بدون تحديد اسم الصنف
  await runEdgeTest(
    4,
    "مرتجع مبهم بدون تحديد الصنف بالضبط (رجعت بضاعة من أحمد)",
    "أحمد محمد المهندس رجع بضاعة بـ 500 جنيه عشان فيها عيب"
  );

  await prisma.$disconnect();
}

main().catch(console.error);

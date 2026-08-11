import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import { prisma } from "@/lib/prisma";

const TENANT_ID = "sim_tenant_uncataloged";
const TENANT_NAME = "محلات العربي لمواد البناء";

async function setupTestData() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      name: TENANT_NAME,
      businessType: "مواد بناء ومقاولات",
      workingHours: "8 صباحاً - 10 مساءً"
    }
  });

  await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId: TENANT_ID, phone: "01055544332" } },
    update: {},
    create: {
      tenantId: TENANT_ID,
      name: "أحمد عربي",
      phone: "01055544332"
    }
  });

  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "اسمنت ممتاز" } },
    update: {},
    create: {
      tenantId: TENANT_ID,
      name: "اسمنت ممتاز",
      unitPrice: 4000,
      stockQuantity: 100,
      isStockItem: true
    }
  });
}

async function runTestCase(testNo: number, title: string, rawUserInput: string) {
  console.log(`\n========================================================================`);
  console.log(`🧪 حالة الاختبار رقم #${testNo}: ${title}`);
  console.log(`========================================================================`);
  console.log(`💬 رسالة التاجر / العميل: "${rawUserInput}"`);
  console.log(`------------------------------------------------------------------------`);

  try {
    const res = await processTelegramMessageWithLLM(
      rawUserInput,
      TENANT_ID,
      TENANT_NAME,
      "مواد بناء ومقاولات",
      "8 صباحاً - 10 مساءً",
      "999111222"
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
  console.log(`\n🚀 بدء اختبار الحالات الخاصة (الأصناف غير المسجلة وتعديل الأسعار)\n`);
  
  await setupTestData();

  // الحالة A: صنف غير مسجل بالكتالوج إطلاقاً بدون ذكر سعر
  await runTestCase(
    1,
    "بيع صنف غير مسجل بالكتالوج وبدون سعر (مسمار 6 سم)",
    "بيع 5 كراتين مسمار 6 سم فى حساب احمد عربى اجل"
  );

  // الحالة B: صنف مسجل بس تم تحديد سعر جديد بالرسالة (تغيير سعر السوق إلى 4200 بدل 4000)
  await runTestCase(
    2,
    "بيع صنف بسعر جديد محدد بالرسالة (4200 بدلاً من 4000 الكتالوج)",
    "بيع 5 طن اسمنت ممتاز بسعر 4200 للطن فى حساب احمد عربى اجل"
  );

  await prisma.$disconnect();
}

main().catch(console.error);

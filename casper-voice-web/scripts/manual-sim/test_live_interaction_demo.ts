import { processTelegramMessageWithLLM } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

const TENANT_ID = "sim_tenant_live";
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
    where: { tenantId_phone: { tenantId: TENANT_ID, phone: "01011122233" } },
    update: {},
    create: {
      tenantId: TENANT_ID,
      name: "أحمد مدحت",
      phone: "01011122233"
    }
  });

  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "حديد تسليح 12مم" } },
    update: {},
    create: {
      tenantId: TENANT_ID,
      name: "حديد تسليح 12مم",
      unitPrice: 45000,
      stockQuantity: 50,
      isStockItem: true
    }
  });
}

async function runScenario(scenarioNo: number, title: string, prompt: string) {
  console.log(`\n========================================================================`);
  console.log(`📌 سيناريو #${scenarioNo}: ${title}`);
  console.log(`========================================================================`);
  console.log(`💬 رسالة العميل (المدخلات): "${prompt}"`);
  console.log(`------------------------------------------------------------------------`);

  try {
    const res = await processTelegramMessageWithLLM(
      prompt,
      TENANT_ID,
      TENANT_NAME,
      "مواد بناء",
      "9 صباحاً - 9 مساءً",
      "888999111"
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
  console.log(`\n🚀 بدء عرض التفاعل الحقيقي المباشر مع الذكاء الاصطناعي (Gemini 3.5 Flash)\n`);
  
  await setupTestData();

  // 1. حجز موعد
  await runScenario(
    1,
    "حجز موعد جديد للعميل",
    `احجز موعد للعميل أحمد مدحت يوم ${TODAY} الساعة 04:00 مساءً لمراجعة الحسابات`
  );

  // 2. استعلام المواعيد
  await runScenario(
    2,
    "استعلام عن قائمة المواعيد",
    "ايه المواعيد المحجوزة عندي النهارده؟"
  );

  // 3. تعديل الموعد
  await runScenario(
    3,
    "تعديل موعد العميل",
    "عدل موعد أحمد مدحت خليه الساعة 06:00 مساءً"
  );

  // 4. استعلام عن حساب العميل
  await runScenario(
    4,
    "كشف حساب العميل ورصيده",
    "استعلم عن كشف حساب ورصيد العميل أحمد مدحت"
  );

  // 5. تسجيل مصروف
  await runScenario(
    5,
    "تسجيل مصروفات المحل",
    "سجل مصروف صيانة كهرباء بمبلغ 1500 جنيه"
  );

  // 6. إلغاء الموعد
  await runScenario(
    6,
    "إلغاء الموعد",
    "الغ موعد العميل أحمد مدحت"
  );

  // DB Verification
  console.log(`\n========================================================================`);
  console.log(`💾 التأكيد المباشر من قاعدة البيانات (RAW DB EVIDENCE AFTER CANCEL):`);
  const appAfterCancel = await prisma.appointment.findFirst({
    where: { tenantId: TENANT_ID, customerName: { contains: "أحمد" } }
  });
  console.log(`رصيد المواعيد للعميل أحمد في قاعدة البيانات:`, appAfterCancel ? appAfterCancel : "NULL (تم الحذف بنجاح)");
  console.log(`========================================================================\n`);

  await prisma.$disconnect();
}

main().catch(console.error);

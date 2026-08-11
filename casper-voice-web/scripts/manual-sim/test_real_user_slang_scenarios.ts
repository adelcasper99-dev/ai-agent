import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import { prisma } from "@/lib/prisma";

const TENANT_ID = "sim_tenant_slang";
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

async function runSlangTest(testNo: number, title: string, rawUserInput: string) {
  console.log(`\n========================================================================`);
  console.log(`🗣️ اختبار العامية الحقيقية #${testNo}: ${title}`);
  console.log(`========================================================================`);
  console.log(`💬 رسالة العميل الخام (Real User Input): "${rawUserInput}"`);
  console.log(`------------------------------------------------------------------------`);

  try {
    const res = await processTelegramMessageWithLLM(
      rawUserInput,
      TENANT_ID,
      TENANT_NAME,
      "مواد بناء ومقاولات",
      "8 صباحاً - 10 مساءً",
      "777666555"
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
  console.log(`\n🚀 بدء اختبار السيناريوهات العامية الواقعية الصعبة من كلام السوق\n`);
  
  await setupTestData();

  // 1. أرقام عربية شرقية + خطأ إملائي بالوحدات + بيع آجل
  await runSlangTest(
    1,
    "بيع آجل بأرقام عربية شرقية (٥) وخطأ (طم اسمنت)",
    "بيع ٥ طم اسمنت فى حساب احمد عربى اجل"
  );

  // 2. سداد عميل بالعامية "دفع من اللي عليه"
  await runSlangTest(
    2,
    "سداد عميل بلغة السوق (دفع 5000 من اللي عليه)",
    "احمد عربى دفع 5000 من اللى عليه"
  );

  // 3. حجز موعد بيوم نسبي "يوم الخميس الساعة 7"
  await runSlangTest(
    3,
    "حجز موعد بيوم نسبي (يوم الخميس الساعة 7)",
    "احجز موعد مع احمد عربى يوم الخميس الساعه 7"
  );

  // 4. استعلام عن الحساب بالعامية
  await runSlangTest(
    4,
    "استعلام حساب بالعامية (أحمد عربي عليه كام دلوقتي)",
    "احمد عربى عليه كام دلوقتي ورصيده ايه؟"
  );

  // 5. تعديل الموعد بلغة عامية
  await runSlangTest(
    5,
    "تعديل الموعد (أخر موعد أحمد عربي خليه 8 بدل 7)",
    "أخر موعد احمد عربى خليه الساعه 8"
  );

  // Raw DB Verification
  console.log(`\n========================================================================`);
  console.log(`💾 كشف الحساب الفعلي في قاعدة البيانات بعد العمليات العامية:`);
  
  const customer = await prisma.customer.findFirst({
    where: { tenantId: TENANT_ID, name: { contains: "أحمد" } }
  });
  console.log(`اسم العميل:`, customer?.name);

  const sales = await prisma.sale.findMany({ where: { tenantId: TENANT_ID } });
  console.log(`حركات المبيعات المسجلة:`, sales.map(s => ({
    totalAmount: s.totalAmount.toString(),
    paidAmount: s.paidAmount.toString(),
    deferredAmount: s.deferredAmount.toString()
  })));

  const payments = await prisma.customerPayment.findMany({ where: { tenantId: TENANT_ID } });
  console.log(`حركات سداد العميل المسجلة:`, payments.map(p => ({
    amount: p.amount.toString(),
    paymentType: p.paymentType
  })));

  const appointments = await prisma.appointment.findMany({ where: { tenantId: TENANT_ID } });
  console.log(`المواعيد المسجلة في DB:`, appointments.map(a => ({
    customerName: a.customerName,
    date: a.date,
    time: a.time
  })));
  console.log(`========================================================================\n`);

  await prisma.$disconnect();
}

main().catch(console.error);

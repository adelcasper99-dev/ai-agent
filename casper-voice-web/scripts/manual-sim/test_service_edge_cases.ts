import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import { prisma } from "@/lib/prisma";

const TENANT_ID = "sim_tenant_service_edges";
const TENANT_NAME = "مركز الرواد للصيانة والتوريدات";

async function setupData() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      name: TENANT_NAME,
      businessType: "صيانة وتوريدات",
      workingHours: "8am - 9pm"
    }
  });

  // منتج مادي
  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "لوحة كهرباء 12 خط" } },
    update: { stockQuantity: 15 },
    create: {
      tenantId: TENANT_ID,
      name: "لوحة كهرباء 12 خط",
      unitPrice: 1200,
      stockQuantity: 15,
      isStockItem: true
    }
  });

  // خدمة صيانة وتركيب
  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "خدمة تركيب وتأسيس" } },
    update: {},
    create: {
      tenantId: TENANT_ID,
      name: "خدمة تركيب وتأسيس",
      unitPrice: 500,
      stockQuantity: 0,
      isStockItem: false // ⚡ خدمة
    }
  });

  // خدمة نقل وتوصيل ديناميكية
  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "خدمة نقل وتوصيل" } },
    update: {},
    create: {
      tenantId: TENANT_ID,
      name: "خدمة نقل وتوصيل",
      unitPrice: 150,
      stockQuantity: 0,
      isStockItem: false // ⚡ خدمة
    }
  });

  await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId: TENANT_ID, phone: "01077766554" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "حسام حسن", phone: "01077766554" }
  });
}

async function runServiceTest(no: number, title: string, prompt: string) {
  console.log(`\n========================================================================`);
  console.log(`🧪 اختبار حالات حافة الخدمات (Service Edge Case) #${no}: ${title}`);
  console.log(`========================================================================`);
  console.log(`💬 رسالة التاجر: "${prompt}"`);
  console.log(`------------------------------------------------------------------------`);

  try {
    const res = await processTelegramMessageWithLLM(
      prompt,
      TENANT_ID,
      TENANT_NAME,
      "صيانة وتوريدات",
      "8am-9pm",
      "888777666"
    );
    console.log(`🤖 رد المساعد الذكي:\n"${res.text}"`);
    console.log(`------------------------------------------------------------------------`);
    console.log(`📊 الحالة: ${res.status.toUpperCase()}`);
  } catch (err: any) {
    console.error(`❌ خطأ:`, err.message);
  }
}

async function main() {
  console.log("🚀 بدء اختبار كافة حالات الحافة الخاصة بتسجيل الخدمات (Service Edge Cases)\n");

  await setupData();

  // Edge 1: بيع منتج + خدمة في أمر واحد
  await runServiceTest(
    1,
    "بيع منتج مادي + خدمة مصنعية في نفس الرسالة الصوتية",
    "بيع 1 لوحة كهرباء 12 خط بـ 1200 وخدمة تركيب وتأسيس بـ 500 لحسام حسن كاش"
  );

  // Edge 2: خدمة بسعر متغير حسب المسافة
  await runServiceTest(
    2,
    "خدمة نقل بسعر ديناميكي متغير (حسب المسافة)",
    "بيع 1 خدمة نقل وتوصيل بسعر 450 جنيه لحسام حسن كاش"
  );

  // Edge 3: خدمة آجلة مع دفع جزء كاش والباقي على حساب العميل
  await runServiceTest(
    3,
    "خدمة صيانة وآجل (دفع جزء والباقي على حساب العميل)",
    "بيع 1 خدمة تركيب وتأسيس بـ 500 لحسام حسن دفع 200 كاش والباقي آجل"
  );

  // Edge 4: خدمة بدون تحديد سعر (حظر الهلوسة)
  await runServiceTest(
    4,
    "طلب تسجيل خدمة بدون تحديد السعر (Anti-Hallucination)",
    "سجل خدمة نقل وتوصيل لحسام حسن"
  );

  // Edge 5: الفرق بين إيراد الخدمة ومصروف الصيانة
  await runServiceTest(
    5,
    "الفرق الدقيق بين إيراد تقديم خدمة ومصروف خرج من المحل",
    "سجل مصروف صيانة وتأسيس بمبلغ 350 جنيه"
  );

  await prisma.$disconnect();
}

main().catch(console.error);

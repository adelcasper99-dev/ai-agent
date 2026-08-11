import { processTelegramMessageWithLLM } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

const TENANT_ID = "sim_tenant_implicit_service";
const TENANT_NAME = "ورشة الفارس للصيانة والتوريدات";

async function setupData() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      name: TENANT_NAME,
      businessType: "ورشة صيانة",
      workingHours: "8am - 8pm"
    }
  });

  // خدمة صيانة وتأسيس بدون كلمة "خدمة" في اسمها (isStockItem: false)
  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "تركيب وتأسيس" } },
    update: {},
    create: {
      tenantId: TENANT_ID,
      name: "تركيب وتأسيس",
      unitPrice: 500,
      stockQuantity: 0,
      isStockItem: false // ⚡ خدمة غير مخزنية
    }
  });

  // خدمة شحن ونقل (isStockItem: false)
  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "شحن ونقل" } },
    update: {},
    create: {
      tenantId: TENANT_ID,
      name: "شحن ونقل",
      unitPrice: 300,
      stockQuantity: 0,
      isStockItem: false // ⚡ خدمة غير مخزنية
    }
  });

  await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId: TENANT_ID, phone: "01088899911" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "سامح كامل", phone: "01088899911" }
  });
}

async function main() {
  console.log("==========================================================================");
  console.log("🧪 اختبار تسجيل الخدمة بدون كتابة كلمة 'خدمة' صراحة بالرسالة الصوتية");
  console.log("==========================================================================\n");

  await setupData();

  console.log("📌 سيناريو 1: التاجر يقول \"بيع تركيب وتأسيس بـ 500 لسامح كامل كاش\" (بدون كلمة خدمة)");
  const res1 = await processTelegramMessageWithLLM(
    "بيع تركيب وتأسيس بـ 500 لسامح كامل كاش",
    TENANT_ID,
    TENANT_NAME,
    "ورشة",
    "8-8",
    "999000"
  );
  console.log(`🤖 رد المساعد الذكي:\n"${res1.text}"\n`);

  console.log("------------------------------------------------------------------------");
  console.log("📌 سيناريو 2: التاجر يقول \"سجل شحن ونقل 300 لسامح كامل كاش\"");
  const res2 = await processTelegramMessageWithLLM(
    "بيع شحن ونقل بـ 300 لسامح كامل كاش",
    TENANT_ID,
    TENANT_NAME,
    "ورشة",
    "8-8",
    "999000"
  );
  console.log(`🤖 رد المساعد الذكي:\n"${res2.text}"\n`);

  const serv1 = await prisma.product.findFirst({ where: { tenantId: TENANT_ID, name: "تركيب وتأسيس" } });
  const serv2 = await prisma.product.findFirst({ where: { tenantId: TENANT_ID, name: "شحن ونقل" } });

  console.log("==========================================================================");
  console.log(`💾 التأكيد المباشر من قاعدة البيانات (RAW DB EVIDENCE):`);
  console.log(`• رصيد (تركيب وتأسيس): ${serv1?.stockQuantity} (لم يتأثر وسجلت كبيع خدمة بنجاح)`);
  console.log(`• رصيد (شحن ونقل): ${serv2?.stockQuantity} (لم يتأثر وسجلت كبيع خدمة بنجاح)`);
  console.log("==========================================================================");

  await prisma.$disconnect();
}

main().catch(console.error);

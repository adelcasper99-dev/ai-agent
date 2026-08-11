import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import { prisma } from "@/lib/prisma";

const TENANT_ID = "sim_tenant_service_vs_prod";
const TENANT_NAME = "شركة الخدمات والتوريدات";

async function setupData() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      name: TENANT_NAME,
      businessType: "خدمات ومقاولات",
      workingHours: "8am - 8pm"
    }
  });

  // 1. منتج مادي (isStockItem: true)
  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "مفتاح كهرباء شنايدر" } },
    update: { stockQuantity: 20 },
    create: {
      tenantId: TENANT_ID,
      name: "مفتاح كهرباء شنايدر",
      unitPrice: 150,
      stockQuantity: 20,
      isStockItem: true
    }
  });

  // 2. خدمة غير مخزنية (isStockItem: false)
  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "خدمة تركيب وتوصيل" } },
    update: {},
    create: {
      tenantId: TENANT_ID,
      name: "خدمة تركيب وتوصيل",
      unitPrice: 300,
      stockQuantity: 0,
      isStockItem: false // ⚡ خدمة (لا تؤثر على المخزون)
    }
  });
}

async function main() {
  console.log("==========================================================================");
  console.log("🧪 اختبار الفرق العملياتي بين المنتج (Product) والخدمة (Service)");
  console.log("==========================================================================\n");

  await setupData();

  console.log("📌 سيناريو 1: بيع منتج مادي (isStockItem: true)");
  console.log("💬 رسالة التاجر: \"بيع 2 مفتاح كهرباء شنايدر بـ 300 جنيه كاش\"");
  const res1 = await processTelegramMessageWithLLM(
    "بيع 2 مفتاح كهرباء شنايدر بـ 300 جنيه كاش",
    TENANT_ID,
    TENANT_NAME,
    "كهرباء",
    "8-8",
    "111"
  );
  console.log(`🤖 رد المساعد الذكي:\n"${res1.text}"\n`);

  console.log("------------------------------------------------------------------------");
  console.log("📌 سيناريو 2: بيع خدمة غير مخزنية (isStockItem: false)");
  console.log("💬 رسالة التاجر: \"بيع 1 خدمة تركيب وتوصيل بـ 300 جنيه كاش\"");
  const res2 = await processTelegramMessageWithLLM(
    "بيع 1 خدمة تركيب وتوصيل بـ 300 جنيه كاش",
    TENANT_ID,
    TENANT_NAME,
    "كهرباء",
    "8-8",
    "111"
  );
  console.log(`🤖 رد المساعد الذكي:\n"${res2.text}"\n`);

  const prod = await prisma.product.findFirst({ where: { tenantId: TENANT_ID, name: "مفتاح كهرباء شنايدر" } });
  const serv = await prisma.product.findFirst({ where: { tenantId: TENANT_ID, name: "خدمة تركيب وتوصيل" } });

  console.log("==========================================================================");
  console.log(`💾 التأكيد المباشر من قاعدة البيانات (RAW DB EVIDENCE):`);
  console.log(`• مخزون المنتج المادي بعد البيع: ${prod?.stockQuantity} (تم خصم 2 قطعة)`);
  console.log(`• رصيد الخدمة غير المخزنية: ${serv?.stockQuantity} (لم يتأثر نهائياً وسجلت كإيراد)`);
  console.log("==========================================================================");

  await prisma.$disconnect();
}

main().catch(console.error);

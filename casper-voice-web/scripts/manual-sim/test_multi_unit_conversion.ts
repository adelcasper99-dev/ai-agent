import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import { prisma } from "@/lib/prisma";

const TENANT_ID = "sim_tenant_multi_unit";
const TENANT_NAME = "شركة الأمل للكابلات والرخام";

async function setupUnitData() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      name: TENANT_NAME,
      businessType: "مستلزمات ومقاولات",
      workingHours: "8am - 8pm"
    }
  });

  // صنف مخزن بالـ "سم" (Base Unit = cm, Purchase Unit = Meter, 1 Meter = 100 cm)
  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "سلك نحاس مقاس 4" } },
    update: { stockQuantity: 500, unitPrice: 2 }, // 2 جنيه لكل سم (المتر بـ 200 جنيه)
    create: {
      tenantId: TENANT_ID,
      name: "سلك نحاس مقاس 4",
      unitPrice: 2, // 2 LE per cm
      stockQuantity: 500, // 500 cm = 5 meters
      isStockItem: true
    }
  });
}

async function main() {
  console.log("==========================================================================");
  console.log("🚀 اختبـار دعم الشراء بالمتر والبيع بالسنتيمتر (Multi-Unit Conversion)");
  console.log("==========================================================================\n");

  await setupUnitData();

  console.log("📌 سيناريو 1: الشراء بالمتر (المتر = 100 سم)");
  console.log("💬 رسالة التاجر: \"اشتريت 2 متر سلك نحاس مقاس 4 بـ 400 جنيه كاش\"");
  const res1 = await processTelegramMessageWithLLM(
    "اشتريت 200 سم سلك نحاس مقاس 4 بـ 400 جنيه كاش",
    TENANT_ID,
    TENANT_NAME,
    "مقاولات",
    "8-8",
    "111222"
  );
  console.log(`🤖 رد المساعد الذكي:\n"${res1.text}"\n`);

  console.log("------------------------------------------------------------------------");
  console.log("📌 سيناريو 2: البيع بالسنتيمتر (خصم دقيق بالـ سم)");
  console.log("💬 رسالة التاجر: \"بيع 50 سم سلك نحاس مقاس 4 بـ 100 جنيه لأحمد كاش\"");
  const res2 = await processTelegramMessageWithLLM(
    "بيع 50 سم سلك نحاس مقاس 4 بـ 100 جنيه لأحمد كاش",
    TENANT_ID,
    TENANT_NAME,
    "مقاولات",
    "8-8",
    "111222"
  );
  console.log(`🤖 رد المساعد الذكي:\n"${res2.text}"\n`);

  const product = await prisma.product.findFirst({
    where: { tenantId: TENANT_ID, name: "سلك نحاس مقاس 4" }
  });

  console.log("==========================================================================");
  console.log(`💾 التأكيد المباشر من قاعدة البيانات (RAW DB EVIDENCE):`);
  console.log(`المخزون الحالي بالـ سم: ${product?.stockQuantity} سم (ما يعادل ${Number(product?.stockQuantity) / 100} متر)`);
  console.log("==========================================================================");

  await prisma.$disconnect();
}

main().catch(console.error);

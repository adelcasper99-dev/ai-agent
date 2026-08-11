import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import { prisma } from "@/lib/prisma";

const TENANT_ID = "sim_tenant_personalization";
const TENANT_NAME = "محلات محمود لمواد البناء";

async function setupData() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      name: TENANT_NAME,
      businessType: "مواد بناء",
      workingHours: "8am - 9pm"
    }
  });

  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "اسمنت ممتاز" } },
    update: { stockQuantity: 100 },
    create: {
      tenantId: TENANT_ID,
      name: "اسمنت ممتاز",
      unitPrice: 4000,
      stockQuantity: 100,
      isStockItem: true
    }
  });
}

async function main() {
  console.log("==========================================================================");
  console.log("🚀 اختبار التخصيص والمخاطبة الشخصية للتاجر (Personalized Merchant Greeting)");
  console.log("==========================================================================\n");

  await setupData();

  console.log("📌 سيناريو 1: التاجر يسلم ويعرّف بنفسه (أنا أستاذ محمود)");
  console.log("💬 رسالة التاجر: \"أنا أستاذ محمود صاحب المحل صباح الخير\"");
  const res1 = await processTelegramMessageWithLLM(
    "أنا أستاذ محمود صاحب المحل صباح الخير",
    TENANT_ID,
    TENANT_NAME,
    "مواد بناء",
    "8am - 9pm",
    "999444"
  );
  console.log(`🤖 رد المساعد الذكي:\n"${res1.text}"\n`);

  console.log("------------------------------------------------------------------------");
  console.log("📌 سيناريو 2: المخاطبة باسم التاجر أثناء تسجيل عملية بيع");
  console.log("💬 رسالة التاجر: \"بيع 2 طن اسمنت ممتاز بـ 8000 كاش\"");
  const res2 = await processTelegramMessageWithLLM(
    "بيع 2 طن اسمنت ممتاز بـ 8000 كاش",
    TENANT_ID,
    TENANT_NAME,
    "مواد بناء",
    "8am - 9pm",
    "999444"
  );
  console.log(`🤖 رد المساعد الذكي:\n"${res2.text}"\n`);

  await prisma.$disconnect();
}

main().catch(console.error);

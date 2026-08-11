import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import { prisma } from "@/lib/prisma";

const TENANT_ID = "sim_tenant_onboarding_demo";
const TENANT_NAME = "محلات أمل للتجارة";

async function setupCleanTenant() {
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
  await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: TENANT_NAME,
      merchantName: null, // First time user — no merchant name set yet!
      businessType: "تجارة عامة",
      workingHours: "9am - 10pm"
    }
  });
}

async function main() {
  console.log("==========================================================================");
  console.log("🚀 اختبار رحلة الـ Onboarding وحفظ اسم التاجر الدائم بالداتابيز");
  console.log("==========================================================================\n");

  await setupCleanTenant();

  console.log("📌 الخطوة 1: أول رسالة من تاجر جديد لسه ملوش اسم بالسيستم");
  console.log("💬 رسالة التاجر الأولى: \"سلام عليكم\"");
  const res1 = await processTelegramMessageWithLLM(
    "سلام عليكم",
    TENANT_ID,
    TENANT_NAME,
    "تجارة عامة",
    "9am - 10pm",
    "888777666"
  );
  console.log(`🤖 رد النظام الترحيبي:\n"${res1.text}"\n`);

  console.log("------------------------------------------------------------------------");
  console.log("📌 الخطوة 2: التاجر يرسل اسمه ليتسجل بالسيستم");
  console.log("💬 رسالة التاجر التاعبة: \"مستر محمود\"");
  const res2 = await processTelegramMessageWithLLM(
    "مستر محمود",
    TENANT_ID,
    TENANT_NAME,
    "تجارة عامة",
    "9am - 10pm",
    "888777666"
  );
  console.log(`🤖 رد النظام بعد تسجيل الاسم:\n"${res2.text}"\n`);

  // Verify Database State
  const dbTenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });
  console.log(`💾 الاسم المسجل بقاعدة البيانات بالـ DB: "${dbTenant?.merchantName}"\n`);

  console.log("------------------------------------------------------------------------");
  console.log("📌 الخطوة 3: التاجر يرجع بعد فترة ويطلب تسجيل عملية (السيستم يناديه بـ مستر محمود)");
  console.log("💬 رسالة التاجر التالية: \"سجل مصروف كهرباء بـ 500\"");
  const res3 = await processTelegramMessageWithLLM(
    "سجل مصروف كهرباء بـ 500",
    TENANT_ID,
    TENANT_NAME,
    "تجارة عامة",
    "9am - 10pm",
    "888777666"
  );
  console.log(`🤖 رد النظام مع المخاطبة الشخصية المعتمدة:\n"${res3.text}"\n`);

  await prisma.$disconnect();
}

main().catch(console.error);

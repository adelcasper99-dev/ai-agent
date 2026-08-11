import { processTelegramMessageWithLLM } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

const TENANT_ID = "sim_tenant_gibberish";
const TENANT_NAME = "محلات الشروق لمواد البناء";

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
}

async function runGibberishTest(testNo: number, prompt: string) {
  console.log(`\n========================================================================`);
  console.log(`🧪 اختبار المدخلات العشوائية / الحروف الإنجليزية الغير مفهومة #${testNo}`);
  console.log(`========================================================================`);
  console.log(`💬 مدخلات التاجر (Gibberish Input): "${prompt}"`);
  console.log(`------------------------------------------------------------------------`);

  try {
    const res = await processTelegramMessageWithLLM(
      prompt,
      TENANT_ID,
      TENANT_NAME,
      "مواد بناء",
      "9 صباحاً - 9 مساءً",
      "999333222"
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
  console.log(`\n🚀 بدء اختبار استجابة المساعد الذكي للحروف العشوائية العابرة\n`);
  
  await setupTestData();

  // 1. المدخل المطلوب بالضبط من المستخدم: "sajas"
  await runGibberishTest(1, "sajas");

  // 2. مدخل عشوائي إنجليزي ثاني: "asdfghjkl"
  await runGibberishTest(2, "asdfghjkl");

  await prisma.$disconnect();
}

main().catch(console.error);

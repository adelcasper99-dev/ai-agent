import { processTelegramMessageWithLLM } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

async function runTest(testName: string, prompt: string) {
  console.log(`\n========================================`);
  console.log(`🧪 TEST: ${testName}`);
  console.log(`🗣️ المدخلات: "${prompt}"`);
  console.log(`========================================`);

  try {
    const reply = await processTelegramMessageWithLLM(
      prompt,
      "sim_tenant_1",
      "Test Store",
      "Retail",
      "9am-5pm",
      `chat_ambig_${Date.now()}`
    );
    console.log(`🤖 الرد الفعلي:\n${typeof reply === 'object' ? JSON.stringify(reply, null, 2) : reply}`);
  } catch (e: any) {
    console.log(`❌ خطأ: ${e.message}`);
  }
}

async function main() {
  // Test Case 1: Arabic Eastern Numerals (أرقام هندية/شرقية: ٥٠٠ جنيه)
  await runTest("الأرقام العربية/الهندية (٥٠٠ جنيه)", "دفعت ٥٠٠ جنيه فاتورة المية للمحل");

  // Test Case 2: Incomplete Input (مدخلات ناقصة)
  await runTest("مدخلات ناقصة بدون مبلغ", "دفعت فاتورة الكهرباء");

  // Test Case 3: Ambiguous Product (صنف غير محدد أو مبهم)
  await runTest("صنف مبهم / غير معروف", "سجل بيع حاجة بـ 100 لأحمد");
}

main().finally(() => prisma.$disconnect());

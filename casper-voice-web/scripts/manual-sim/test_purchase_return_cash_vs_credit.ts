import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== Testing Purchase Return: Deferred/Credit vs Cash Refund ===");
  const tenantId = "sim_tenant_1";

  // Ensure supplier Ahmed Arabi exists
  let supplier = await prisma.supplier.findFirst({ where: { tenantId, name: { contains: "عربى" } } });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: { tenantId, name: "احمد عربى", phone: "01100000000" }
    });
  }

  // 1. Prompt with Deferred/Credit Return (Didn't receive cash):
  const promptCredit = "رجعت ٥ طن بطاطس لاحمد عربى ثمنها ٥٠٠٠ وخصمتهم من حسابه";
  console.log(`\n🗣️ Test Deferred Purchase Return: "${promptCredit}"`);
  const resCredit = await processTelegramMessageWithLLM(promptCredit, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response (Credit Return):\n", JSON.stringify(resCredit, null, 2));

  // 2. Prompt with Cash Return (Received cash):
  const promptCash = "رجعت ٥ طن بطاطس لاحمد عربى ثمنها ٥٠٠٠ وخدت فلوسها كاش";
  console.log(`\n🗣️ Test Cash Purchase Return: "${promptCash}"`);
  const resCash = await processTelegramMessageWithLLM(promptCash, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response (Cash Return):\n", JSON.stringify(resCash, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);

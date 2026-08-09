import { processTelegramMessageWithLLM } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

async function main() {
  console.log("=== Testing Ambiguous Numeric Clarification Protocol ===");
  const tenantId = "sim_tenant_1";

  // Test 1: Ambiguous Prompt (No prepositions for 50000 & 10000)
  const ambiguousPrompt = "اشتريت بطاطس من احمد عربى 50000 10000";
  console.log(`\n🗣️ Test 1 (Ambiguous Input): "${ambiguousPrompt}"`);
  const res1 = await processTelegramMessageWithLLM(ambiguousPrompt, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response 1:\n", JSON.stringify(res1, null, 2));

  // Test 2: Unambiguous Prompt (With explicit prepositions)
  const unambiguousPrompt = "اشتريت 50 طم بطاطس من احمد عربى ب 50000 دفعت 10000";
  console.log(`\n🗣️ Test 2 (Unambiguous Input): "${unambiguousPrompt}"`);
  const res2 = await processTelegramMessageWithLLM(unambiguousPrompt, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response 2:\n", JSON.stringify(res2, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);

import { processTelegramMessageWithLLM, executeTool } from "../lib/telegram_llm";
import { prisma } from "../lib/prisma";
import Decimal from "decimal.js";

async function runLiveTestSamples() {
  console.log("===============================================================");
  console.log("🛠️ CASPER REAL-WORLD TEST SAMPLES & LIVE DEMONSTRATION");
  console.log("===============================================================\n");

  const testTenantId = "demo_workshop_tenant_" + Date.now();
  const testChatId = "test_chat_real_" + Date.now();

  // 1. Seed Tenant
  await (prisma as any).tenant.create({
    data: {
      id: testTenantId,
      name: "ورشة الإخلاص",
      merchantName: "ورشة الإخلاص للألوميتال والمطابخ",
      businessType: "Alumital & Kitchens",
      telegramChatId: testChatId
    }
  });

  console.log("🏢 Tenant Seeded:", "ورشة الإخلاص للألوميتال والمطابخ\n");

  // SAMPLE 1: Voice message with single window measurement + specs
  console.log("---------------------------------------------------------------");
  console.log("🔹 [SAMPLE 1] تسجيل مقاس شباك قطاع بي اس وزجاج دبل");
  const prompt1 = "سجل مقاس للعميل محمد صادق شباك 120 في 140 قطاع بي اس كبير زجاج دبل وسلك بليسيه";
  console.log("👤 رسالة التاجر (صوت/نص):", `"${prompt1}"`);
  const res1 = await processTelegramMessageWithLLM(prompt1, testTenantId, "ورشة الإخلاص", "Alumital", "9-5", testChatId);
  console.log("🤖 رد البوت (Caveman Mode):", res1.text);
  console.log("---------------------------------------------------------------\n");

  // SAMPLE 2: Complex Kitchen Project with Depth and Multi-Items
  console.log("---------------------------------------------------------------");
  console.log("🔹 [SAMPLE 2] تسجيل مطبخ كامل متعدد الأجزاء بالعمق والإكسسوارات");
  const prompt2 = "سجل مقاسات مطبخ للعميل المهندس طارق: علوي 250 في 80 عمق 35، وسفلي 250 في 90 عمق 60 خامة كلادينج ألماني مع مفصلات باكم ومقابض بلت إن";
  console.log("👤 رسالة التاجر (صوت/نص):", `"${prompt2}"`);
  const res2 = await processTelegramMessageWithLLM(prompt2, testTenantId, "ورشة الإخلاص", "Alumital", "9-5", testChatId);
  console.log("🤖 رد البوت (Caveman Mode):", res2.text);
  console.log("---------------------------------------------------------------\n");

  // SAMPLE 3: Retrieval / Inquiries
  console.log("---------------------------------------------------------------");
  console.log("🔹 [SAMPLE 3] استرجاع كشف مقاسات عميل");
  const prompt3 = "هاتلي مقاسات العميل محمد صادق";
  console.log("👤 رسالة التاجر (صوت/نص):", `"${prompt3}"`);
  const res3 = await processTelegramMessageWithLLM(prompt3, testTenantId, "ورشة الإخلاص", "Alumital", "9-5", testChatId);
  console.log("🤖 رد البوت (Caveman Mode):", res3.text);
  console.log("---------------------------------------------------------------\n");

  // SAMPLE 4: Quick Dimensions Edit
  console.log("---------------------------------------------------------------");
  console.log("🔹 [SAMPLE 4] تعديل أبعاد بند موجود للعميل");
  const prompt4 = "عدل شباك العميل محمد صادق خليه 130 في 150";
  console.log("👤 رسالة التاجر (صوت/نص):", `"${prompt4}"`);
  const res4 = await processTelegramMessageWithLLM(prompt4, testTenantId, "ورشة الإخلاص", "Alumital", "9-5", testChatId);
  console.log("🤖 رد البوت (Caveman Mode):", res4.text);
  console.log("---------------------------------------------------------------\n");

  // SAMPLE 5: Quotation Calculation without collision
  console.log("---------------------------------------------------------------");
  console.log("🔹 [SAMPLE 5] طلب عرض سعر ومقايسة مالية (Quotation)");
  const prompt5 = "احسبلي كوتيشن شباك 120 في 120 سعر المتر 1600 للعميل محمد صادق";
  console.log("👤 رسالة التاجر (صوت/نص):", `"${prompt5}"`);
  const res5 = await processTelegramMessageWithLLM(prompt5, testTenantId, "ورشة الإخلاص", "Alumital", "9-5", testChatId);
  console.log("🤖 رد البوت (Caveman Mode):", res5.text);
  console.log("---------------------------------------------------------------\n");

  // SAMPLE 6: Caveman Short-Circuit & No Apologies
  console.log("---------------------------------------------------------------");
  console.log("🔹 [SAMPLE 6] اختبار منع الاعتذارات والردود الطويلة (Strict Caveman)");
  const prompt6 = "هاتلي مقاسات العميل إبراهيم الفقي";
  console.log("👤 رسالة التاجر (صوت/نص):", `"${prompt6}"`);
  const res6 = await processTelegramMessageWithLLM(prompt6, testTenantId, "ورشة الإخلاص", "Alumital", "9-5", testChatId);
  console.log("🤖 رد البوت (Caveman Mode):", res6.text);
  console.log("---------------------------------------------------------------\n");

  // Cleanup
  await (prisma as any).customerMeasurement.deleteMany({ where: { tenantId: testTenantId } });
  await (prisma as any).tenant.deleteMany({ where: { id: testTenantId } });

  console.log("===============================================================");
  console.log("🎉 ALL 6 REAL-WORLD SAMPLES EXECUTED SUCCESSFULLY!");
  console.log("===============================================================");
}

runLiveTestSamples().catch(console.error);

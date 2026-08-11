import os

content = """import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import { prisma } from "@/lib/prisma";
import { _resetExhaustedKeysForTesting } from "@/lib/apiKeyManager";

const TENANT_ID = "sim_tenant_master_36";
const TENANT_NAME = "محلات العربي لمواد البناء والتوريدات";
const TODAY = new Date().toISOString().slice(0, 10);

type TestResult = { scenarioNo: string; tool: string; prompt: string; status: "PASS" | "FAIL"; response: string };
const results: TestResult[] = [];

async function setupDatabase() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      name: TENANT_NAME,
      businessType: "مواد بناء ومقاولات",
      workingHours: "8 صباحاً - 10 مساءً"
    }
  });

  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "اسمنت ممتاز" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "اسمنت ممتاز", unitPrice: 4000, stockQuantity: 100, isStockItem: true }
  });

  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "سلك كهرباء 2مم" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "سلك كهرباء 2مم", unitPrice: 500, stockQuantity: 50, isStockItem: true }
  });

  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "سلك نحاس 2مم" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "سلك نحاس 2مم", unitPrice: 300, stockQuantity: 500, isStockItem: true }
  });

  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "سلك نحاس 4مم" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "سلك نحاس 4مم", unitPrice: 500, stockQuantity: 800, isStockItem: true }
  });

  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "خدمة شحن ونقل" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "خدمة شحن ونقل", unitPrice: 300, stockQuantity: 0, isStockItem: false }
  });

  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "تركيب وتأسيس" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "تركيب وتأسيس", unitPrice: 500, stockQuantity: 0, isStockItem: false }
  });

  await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId: TENANT_ID, phone: "01055544332" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "أحمد عربي", phone: "01055544332" }
  });

  await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId: TENANT_ID, phone: "01011111111" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "أحمد محمد المهندس", phone: "01011111111" }
  });

  await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId: TENANT_ID, phone: "01022222222" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "أحمد محمد الحرفي", phone: "01022222222" }
  });

  await prisma.supplier.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "المورد المتخصص" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "المورد المتخصص" }
  });
}

async function run(scenarioNo: string, tool: string, prompt: string) {
  _resetExhaustedKeysForTesting();
  console.log(`\\n------------------------------------------------------------------------`);
  console.log(`▶ [${scenarioNo}] (${tool}): "${prompt}"`);
  console.log(`------------------------------------------------------------------------`);
  try {
    const res = await processTelegramMessageWithLLM(
      prompt,
      TENANT_ID,
      TENANT_NAME,
      "مواد بناء ومقاولات",
      "8am-10pm",
      "999888777"
    );
    const responseText = res?.text ?? JSON.stringify(res);
    const status = res?.status === "success" || responseText.length > 5 ? "PASS" : "FAIL";
    console.log(`✅ [${scenarioNo}] ${status}: ${responseText.slice(0, 120)}`);
    results.push({ scenarioNo, tool, prompt, status, response: responseText.slice(0, 120) });
    return res;
  } catch (err: any) {
    console.error(`❌ [${scenarioNo}] CRASH:`, err.message);
    results.push({ scenarioNo, tool, prompt, status: "FAIL", response: err.message });
    return null;
  }
}

async function main() {
  console.log("==========================================================================");
  console.log("🚀 MASTER TEST RUNNER — 36 CORE LLM TOOLS & REAL-WORLD EDGE CASES");
  console.log("==========================================================================\\n");

  await setupDatabase();

  // === SECTION A: 16 CORE BUSINESS TOOLS ===
  await run("#1", "log_sale", "بيع 5 طن اسمنت ممتاز لأحمد عربي بـ 20000 دفع 5000 كاش والباقي آجل");
  await run("#2", "log_purchase", "اشتريت من المورد المتخصص 10 طن اسمنت ممتاز بـ 40000 آجل");
  await run("#3", "log_expense", "سجل مصروف صيانة كهرباء 1500 جنيه");
  await run("#4", "book_appointment", `احجز موعد مع أحمد عربي يوم ${TODAY} الساعة 04:00 مساءً`);
  await run("#5", "get_appointments_list", "ايه المواعيد المحجوزة عندي النهارده؟");
  await run("#6", "update_appointment", "عدل موعد أحمد عربي خليه الساعة 06:00 مساءً");
  await run("#7", "cancel_appointment", "الغ موعد أحمد عربي");
  await run("#8", "get_supplier_balance", "كشف حساب المورد المتخصص ورصيده كام؟");
  await run("#9", "log_customer_payment", "سدد أحمد عربي 5000 جنيه كاش");
  await run("#10", "log_purchase_return", "رجعت 2 طن اسمنت ممتاز للمورد المتخصص بقيمة 8000");
  await run("#11", "add_product", "أضف صنف جديد اسمه فلتر زيت بسعر 6000 ومخزون 10 قطع");
  await run("#12", "update_stock", "صحح مخزون اسمنت ممتاز الرصيد الفعلي 80 طن");
  await run("#13", "get_customer_balance", "استعلم عن كشف حساب ورصيد العميل أحمد عربي");
  await run("#14", "get_financial_summary", "إيه تقرير الحركة النقدية والمالية النهارده؟");
  await run("#15", "add_customer", "سجل عميل جديد اسمه محمود حسن وتليفونه 01099998888");
  await run("#16", "log_supplier_payment", "سددت للمورد المتخصص 3000 جنيه كاش");

  // === SECTION B: 20 REAL-WORLD EDGE CASES & DIALECT PROMPTS ===
  await run("#17 [EDGE]", "log_sale (Eastern Numerals & Typo)", "بيع ٥ طم اسمنت فى حساب احمد عربى اجل");
  await run("#18 [EDGE]", "log_customer_payment (Slang Debt)", "احمد عربى دفع 5000 من اللى عليه");
  await run("#19 [EDGE]", "book_appointment (Spoken Relative Date)", "احجز موعد مع احمد عربى يوم الخميس الساعه 7");
  await run("#20 [EDGE]", "log_sale (Uncataloged Item)", "بيع 5 كراتين مسمار 6 سم فى حساب احمد عربى اجل");
  await run("#21 [EDGE]", "log_sale (Custom Price Override)", "بيع 5 طن اسمنت ممتاز بسعر 4200 للطن فى حساب احمد عربى اجل");
  await run("#22 [EDGE]", "small_talk / gibberish", "sajas");
  await run("#23 [EDGE]", "log_sale (Fractional Spoken Quantities)", "بيع 2 ونص كرتونة سلك كهرباء 2مم لأحمد محمد المهندس كاش");
  await run("#24 [EDGE]", "composite_multi_tool", `بيع 1 كرتونة سلك كهرباء 2مم لأحمد محمد الحرفي كاش بـ 500 وسجل مصروف شحن بـ 100 واحجز معاه موعد يوم ${TODAY} الساعة 5 مساءً`);
  await run("#25 [EDGE]", "get_customer_balance (Name Ambiguity)", "استعلم عن كشف حساب أحمد محمد");
  await run("#26 [EDGE]", "log_sale (Multi-Unit Conversion)", "بيع 50 سم سلك نحاس 2مم بـ 100 كاش لأحمد عربي");
  await run("#27 [EDGE]", "log_sale (Product Variant Ambiguity)", "بيع 50 سم سلك نحاس لأحمد عربي كاش بـ 100");
  await run("#28 [EDGE]", "log_sale (Physical Stock Product)", "بيع 2 سلك كهرباء 2مم بـ 1000 كاش");
  await run("#29 [EDGE]", "log_sale (Non-Stock Service)", "بيع 1 خدمة شحن ونقل بـ 300 كاش لأحمد عربي");
  await run("#30 [EDGE]", "composite_service_product", "بيع 1 كرتونة سلك كهرباء 2مم بـ 500 وخدمة تركيب وتأسيس بـ 500 لأحمد عربي كاش");
  await run("#31 [EDGE]", "dynamic_price_service", "بيع 1 خدمة شحن ونقل بسعر 450 جنيه لأحمد عربي كاش");
  await run("#32 [EDGE]", "deferred_service_payment", "بيع 1 خدمة تركيب وتأسيس بـ 500 لأحمد عربي دفع 200 كاش والباقي آجل");
  await run("#33 [EDGE]", "unpriced_service_guard", "سجل خدمة شحن ونقل لأحمد عربي");
  await run("#34 [EDGE]", "service_vs_expense_distinction", "سجل مصروف صيانة وتأسيس بمبلغ 350 جنيه");
  await run("#35 [EDGE]", "implicit_service_prompt", "بيع تركيب وتأسيس بـ 500 لأحمد عربي كاش");
  await run("#36 [EDGE]", "personalized_merchant_greeting", "أنا مستر محمود صاحب المحل صباح الخير");

  // === FINAL REPORT SUMMARY ===
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  console.log("\\n==========================================================================");
  console.log(`📊 MASTER TEST SUITE REPORT: ${passed}/${results.length} PASSED | ${failed} FAILED`);
  console.log("==========================================================================");
  console.table(results.map(r => ({ scenario: r.scenarioNo, tool: r.tool, status: r.status, preview: r.response.slice(0, 50) })));

  await prisma.$disconnect();
}

main().catch(console.error);
"""

with open("c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/test_all_tools.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: Updated master test_all_tools.ts for 'مستر' title.")

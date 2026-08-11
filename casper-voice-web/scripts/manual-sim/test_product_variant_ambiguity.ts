import { processTelegramMessageWithLLM } from "./lib/telegram_llm";
import { prisma } from "./lib/prisma";

const TENANT_ID = "sim_tenant_variants";
const TENANT_NAME = "محلات الكابلات العالمية";

async function setupVariants() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      name: TENANT_NAME,
      businessType: "كهرباء ومقاولات",
      workingHours: "8am - 8pm"
    }
  });

  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "سلك نحاس 2مم" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "سلك نحاس 2مم", unitPrice: 300, stockQuantity: 100, isStockItem: true }
  });

  await prisma.product.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: "سلك نحاس 4مم" } },
    update: {},
    create: { tenantId: TENANT_ID, name: "سلك نحاس 4مم", unitPrice: 500, stockQuantity: 80, isStockItem: true }
  });
}

async function main() {
  console.log("==========================================================================");
  console.log("🧪 اختبار التنازع عند عدم تحديد مقاس الصنف (Unspecified Product Variant)");
  console.log("==========================================================================\n");

  await setupVariants();

  console.log("💬 رسالة التاجر بدون تحديد المقاس: \"بيع 50 سم سلك نحاس لأحمد كاش بـ 100\"");
  const res = await processTelegramMessageWithLLM(
    "بيع 50 سم سلك نحاس لأحمد كاش بـ 100",
    TENANT_ID,
    TENANT_NAME,
    "كهرباء",
    "8-8",
    "777999"
  );

  console.log("🤖 رد المساعد الذكي:");
  console.log(`"${res.text}"\n`);

  await prisma.$disconnect();
}

main().catch(console.error);

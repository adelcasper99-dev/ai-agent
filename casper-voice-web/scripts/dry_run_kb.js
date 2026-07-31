const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.knowledgeItem.findMany();
  console.log(`\n=== KNOWLEDGE ITEM DRY RUN SUMMARY ===`);
  console.log(`Total KnowledgeItems in DB: ${items.length}`);

  const nullTenantItems = items.filter((i) => !i.tenantId);
  const scopedTenantItems = items.filter((i) => i.tenantId);

  console.log(`Items with tenantId already set: ${scopedTenantItems.length}`);
  console.log(`Items with tenantId NULL (unassigned): ${nullTenantItems.length}\n`);

  console.log("ALL ITEMS:", JSON.stringify(items, null, 2));

  // System FAQ keywords
  const systemFaqKeywords = ["مرتجع", "نظام", "كاسبر", "سيستم", "عام", "إعدادات", "pos", "erp", "دفتر", "فاتورة"];

  const categorized = [];

  for (const item of nullTenantItems) {
    const text = `${item.question} ${item.answer} ${item.keywords}`.toLowerCase();
    const isSystemFaq = systemFaqKeywords.some((kw) => text.includes(kw));

    categorized.push({
      id: item.id,
      question: item.question,
      answer: item.answer.length > 50 ? item.answer.substring(0, 50) + "..." : item.answer,
      action: isSystemFaq ? "KEEP_NULL (System FAQ Shared)" : "BACKFILL_MAIN_TENANT",
    });
  }

  console.log("=== DRY RUN CLASSIFICATION RESULTS ===");
  console.log(JSON.stringify(categorized, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });

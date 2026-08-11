import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("--- Testing Function #5: log_purchase (Messy Slang + Eastern Numerals) ---");
  const tenantId = "sim_tenant_1";

  // Ensure catalog has the product or it's added automatically
  await prisma.product.upsert({
    where: { tenantId_name: { tenantId, name: "اسمنت" } },
    update: {},
    create: { tenantId, name: "اسمنت", isStockItem: true, stockQuantity: 10, unitPrice: 50000 }
  });

  const prompt = "سجل فاتورة مشتريات: اشتريت من الحاج محمود 5 طن اسمنت سعر الطن 50000 إجمالي 250000 مدفوع 50000";
  console.log(`🗣️ المستخدم: "${prompt}"`);

  const reply = await processTelegramMessageWithLLM(
    prompt,
    tenantId,
    "Test Store",
    "Retail",
    "9am-5pm",
    `chat_purchase_${Date.now()}`
  );

  console.log(`🤖 المساعد الذكي:\n${typeof reply === 'object' ? JSON.stringify(reply, null, 2) : reply}`);

  // Raw Database Proof
  const purchase = await prisma.purchase.findFirst({
    where: { tenantId, itemName: { contains: "اسمنت" } },
    orderBy: { createdAt: "desc" }
  });

  const updatedProduct = await prisma.product.findFirst({
    where: { tenantId, name: "اسمنت" }
  });

  const supplier = await prisma.supplier.findFirst({
    where: { tenantId, name: { contains: "محمود" } }
  });

  console.log("=== RAW DB EVIDENCE ===");
  console.log("PURCHASE RECORD:", JSON.stringify(purchase, null, 2));
  console.log("UPDATED PRODUCT STOCK (Increased):", JSON.stringify(updatedProduct, null, 2));
  console.log("SUPPLIER RECORD:", JSON.stringify(supplier, null, 2));
}

main().finally(() => prisma.$disconnect());

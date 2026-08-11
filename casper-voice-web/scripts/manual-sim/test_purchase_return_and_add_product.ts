import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== Testing Functions #9 (Purchase Return) & #10 (Add Product) ===");
  const tenantId = "sim_tenant_1";

  // First, ensure supplier Ahmed Arabi and product "بطاطس" exist for purchase return test
  let supplier = await prisma.supplier.findFirst({ where: { tenantId, name: { contains: "عربى" } } });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: { tenantId, name: "احمد عربى", phone: "01100000000" }
    });
  }

  let product = await prisma.product.findFirst({ where: { tenantId, name: { contains: "بطاطس" } } });
  if (!product) {
    product = await prisma.product.create({
      data: { tenantId, name: "بطاطس", unitPrice: 1000, stockQuantity: 100 }
    });
  }

  // ----------------------------------------------------
  // Test Function #9: log_purchase_return
  // ----------------------------------------------------
  const prompt9 = "رجعت ٥ طن بطاطس لاحمد عربى ثمنها ٥٠٠٠ وخدت فلوسها";
  console.log(`\n🗣️ Test Function #9 (Purchase Return): "${prompt9}"`);
  const res9 = await processTelegramMessageWithLLM(prompt9, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response #9:\n", JSON.stringify(res9, null, 2));

  // ----------------------------------------------------
  // Test Function #10: add_product
  // ----------------------------------------------------
  const prompt10 = "ضيف صنف جديد اسمنت بورتلاندى سعر البيع ٦٠٠٠";
  console.log(`\n🗣️ Test Function #10 (Add New Product): "${prompt10}"`);
  const res10 = await processTelegramMessageWithLLM(prompt10, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response #10:\n", JSON.stringify(res10, null, 2));

  // Fetch Raw Database Evidence for Added Product
  const newProduct = await prisma.product.findFirst({
    where: { tenantId, name: { contains: "اسمنت بورتلاندى" } }
  });
  console.log("\n=== RAW DB EVIDENCE (NEW PRODUCT ADDED) ===");
  console.log(JSON.stringify(newProduct, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);

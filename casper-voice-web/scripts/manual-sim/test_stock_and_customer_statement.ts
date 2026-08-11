import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== Testing Functions #11 (Stock Adjustment) & #12 (Customer Statement) ===");
  const tenantId = "sim_tenant_1";

  // Ensure product "بطاطس" exists
  let product = await prisma.product.findFirst({ where: { tenantId, name: { contains: "بطاطس" } } });
  if (!product) {
    product = await prisma.product.create({
      data: { tenantId, name: "بطاطس", unitPrice: 1000, stockQuantity: 100 }
    });
  }

  // Ensure customer "الحاج محمود" exists
  let customer = await prisma.customer.findFirst({ where: { tenantId, name: { contains: "محمود" } } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: { tenantId, name: "الحاج محمود", phone: "01000000000" }
    });
  }

  // ----------------------------------------------------
  // Test Function #11: update_stock
  // ----------------------------------------------------
  const prompt11 = "تعديل رصيد صنف بطاطس المخزون الفعلى ٨٠ طن";
  console.log(`\n🗣️ Test Function #11 (Stock Adjustment): "${prompt11}"`);
  const res11 = await processTelegramMessageWithLLM(prompt11, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response #11:\n", JSON.stringify(res11, null, 2));

  // Verify DB
  const updatedProduct = await prisma.product.findFirst({ where: { tenantId, name: { contains: "بطاطس" } } });
  console.log("\n=== RAW DB EVIDENCE (STOCK UPDATED) ===");
  console.log(JSON.stringify({ name: updatedProduct?.name, stockQuantity: updatedProduct?.stockQuantity }, null, 2));

  // ----------------------------------------------------
  // Test Function #12: get_customer_statement
  // ----------------------------------------------------
  const prompt12 = "طباعة كشف حساب تفصيلى للعميل الحاج محمود";
  console.log(`\n🗣️ Test Function #12 (Customer Statement): "${prompt12}"`);
  const res12 = await processTelegramMessageWithLLM(prompt12, tenantId, "شركة تجريبية", "retail", "9am-5pm", "999888777");
  console.log("🤖 Assistant Response #12:\n", JSON.stringify(res12, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);

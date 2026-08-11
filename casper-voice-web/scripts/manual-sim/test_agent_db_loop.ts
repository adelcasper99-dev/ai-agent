import { PrismaClient } from '@prisma/client';
import { executeTool } from '@/lib/telegram_llm';

const prisma = new PrismaClient();

async function main() {
  let tenantId: string | undefined = undefined;
  
  // Find a valid tenant if available
  const tenant = await prisma.tenant.findFirst();
  if (tenant) {
    tenantId = tenant.id;
  }

  let passCount = 0;
  let failCount = 0;

  async function runTest(name: string, tool: string, args: any, message: string = "Test message") {
    console.log(`\n▶️ Test: ${name}`);
    try {
      const res = await executeTool(tool, args, tenantId, message, Date.now(), 0);
      console.log(`  Output:`, res);
      if (res.success) {
        passCount++;
      } else {
        if (tool === 'log_sale' && !args.force_override) {
          // Expect fail when force override is false for negative stock
          passCount++;
        } else {
          failCount++;
        }
      }
    } catch (e: any) {
      console.log(`  Error:`, e.message);
      failCount++;
    }
  }

  const testProduct = "شاحن تيست " + Date.now();
  console.log("Setup: Create test product");
  await executeTool("add_product", { name: testProduct, is_stock_item: true, stock_quantity: 1, unit_price: 100 }, tenantId, "اضف شاحن تيست", Date.now(), 0);

  await runTest("Get Low Stock", "get_low_stock", { threshold: 5 });

  await runTest("Get Drawer Balance", "get_drawer_balance", {});

  console.log("\n▶️ Test: Overselling without override (should prompt)");
  const saleArgs = { item_name: testProduct, quantity: 2, price: 100 };
  const userMsg = `بيع 2 من ${testProduct} بسعر 100`;
  const saleRes = await executeTool("log_sale", saleArgs, tenantId, userMsg, Date.now(), 0);
  console.log(`  Output:`, saleRes);
  if (!saleRes.success && saleRes.resultText.includes("عفوًا، رصيد الصنف غير كافٍ")) {
    passCount++;
  } else {
    failCount++;
  }

  await runTest("Overselling with force override", "log_sale", { ...saleArgs, force_override: true }, userMsg);

  await runTest("Undo Last Action", "undo_last_action", {}, "تراجع عن اخر حاجه");

  console.log(`\n============================`);
  console.log(`REPORT: ${passCount} PASSED | ${failCount} FAILED`);
  console.log(`============================`);
  
  await prisma.$disconnect();
}

main().catch(console.error);

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { executeTool } from "../lib/telegram_llm";

const prisma = new PrismaClient();
const TENANT_ID = "stock-pressure-tenant";
const CUSTOMER_NAME = "عميل الضغط";
const CUSTOMER_PHONE = "01088888888";

describe("Network Pressure & Races (Stock Constraints)", () => {
  let customerId: string;

  beforeAll(async () => {
    await prisma.tenant.upsert({
      where: { id: TENANT_ID },
      update: {},
      create: { id: TENANT_ID, name: "Stock Pressure Tenant", phoneNumber: `0100${Date.now().toString().slice(-7)}`, state: "active" },
    });

    await prisma.product.deleteMany({ where: { tenantId: TENANT_ID } });

    await prisma.product.create({
      data: { 
        name: "منتج نادر", 
        isStockItem: true, 
        stockQuantity: 5, 
        tenantId: TENANT_ID, 
        unitPrice: 100 
      }
    });

    const customer = await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId: TENANT_ID, phone: CUSTOMER_PHONE } },
      update: {},
      create: { name: CUSTOMER_NAME, phone: CUSTOMER_PHONE, tenantId: TENANT_ID },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await prisma.customerLedgerEntry.deleteMany({ where: { customerId } });
    await prisma.sale.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.customer.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.product.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
    await prisma.$disconnect();
  });

  it("fires 20 concurrent sales for a stock of 5, exactly 5 succeed and 15 reject", async () => {
    const RUN_ID = crypto.randomUUID().slice(0, 8);
    const promises = [];

    for (let i = 0; i < 20; i++) {
      promises.push(
        new Promise(resolve => setTimeout(resolve, Math.random() * 200)).then(() =>
          executeTool(
            "log_sale",
            {
              item_name: "منتج نادر",
              price: 100,
              quantity: 1,
              customer_name: CUSTOMER_NAME,
              customer_phone: CUSTOMER_PHONE,
              paid_amount: 100,
              deferred_amount: 0,
            },
            TENANT_ID,
            "منتج نادر عميل الضغط 100",
            `stock-race-${RUN_ID}-${i}`,
            0
          )
        )
      );
    }

    const results = await Promise.all(promises);

    let successCount = 0;
    let rejectCount = 0;

    for (const res of results) {
      if (res.success) {
        successCount++;
      } else {
        rejectCount++;
      }
    }

    console.log(`[Stock Race Results] Success: ${successCount} | Rejected: ${rejectCount}`);

    expect(successCount).toBe(5);
    expect(rejectCount).toBe(15);
  }, 30000);
});

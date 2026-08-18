import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prismaSystem as prisma } from "@/lib/prisma";
import { executeTool } from "../lib/telegram_llm";

const TENANT_ID = "sync-conflict-tenant";
const CUSTOMER_NAME = "عميل المزامنة";
const CUSTOMER_PHONE = "01099999999";

describe("Sync Conflict Resolution (Idempotency)", () => {
  let customerId: string;

  beforeAll(async () => {
    await prisma.tenant.upsert({
      where: { id: TENANT_ID },
      update: {},
      create: { id: TENANT_ID, name: "Sync Conflict Tenant", phoneNumber: "01000000098", state: "active" },
    });

    await prisma.product.deleteMany({ where: { tenantId: TENANT_ID } });

    await prisma.product.create({
      data: { 
        name: "منتج مزامنة", 
        isStockItem: true, 
        stockQuantity: 1, 
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
    await prisma.journalEntry.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.sale.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.customer.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.product.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.tokenUsage.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.chatMessage.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.conversation.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
  });

  it("handles offline sync race condition gracefully without negative stock", async () => {
    const RUN_ID = crypto.randomUUID().slice(0, 8);
    // Simulate desktop client coming online and pushing a sale, exactly at the same time 
    // a cloud request for the same item is processed.
    
    // We send two concurrent requests for the exact same stock item (only 1 left).
    // They have different idempotency keys so they are treated as two separate sales.
    // One should succeed, the other MUST fail because of stock constraints.
    const desktopSyncPromise = executeTool(
      "log_sale",
      {
        item_name: "منتج مزامنة",
        price: 100,
        quantity: 1,
        customer_name: CUSTOMER_NAME,
        customer_phone: CUSTOMER_PHONE,
        paid_amount: 100,
        deferred_amount: 0,
      },
      TENANT_ID,
      "منتج مزامنة عميل المزامنة 100",
      `desktop-sync-${RUN_ID}`, // Key 1
      0
    );

    const cloudRequestPromise = executeTool(
      "log_sale",
      {
        item_name: "منتج مزامنة",
        price: 100,
        quantity: 1,
        customer_name: CUSTOMER_NAME,
        customer_phone: CUSTOMER_PHONE,
        paid_amount: 100,
        deferred_amount: 0,
      },
      TENANT_ID,
      "منتج مزامنة عميل المزامنة 100",
      `cloud-req-${RUN_ID}`, // Key 2
      0
    );

    const [desktopResult, cloudResult] = await Promise.all([desktopSyncPromise, cloudRequestPromise]);

    const successCount = [desktopResult, cloudResult].filter(r => r.success).length;
    const failureCount = [desktopResult, cloudResult].filter(r => !r.success).length;

    // Verify exactly 1 sale succeeds and 1 fails.
    expect(successCount).toBe(1);
    expect(failureCount).toBe(1);

    // Verify stock is exactly 0 and never -1
    const product = await prisma.product.findFirst({
      where: { name: "منتج مزامنة", tenantId: TENANT_ID }
    });

    expect(product?.stockQuantity).toBe(0);
  });
});

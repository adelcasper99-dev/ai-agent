const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== 1. SALE CONTAMINATION CHECK (idempotencyKey = '1234567890') ===");
  const salesContaminated = await prisma.sale.findMany({
    where: { idempotencyKey: "1234567890" },
    select: {
      id: true,
      tenantId: true,
      itemName: true,
      price: true,
      quantity: true,
      total: true,
      customerName: true,
      createdAt: true
    }
  });
  console.log("Contaminated Sales Count:", salesContaminated.length);
  console.log(JSON.stringify(salesContaminated, null, 2));

  console.log("\n=== 2. ALL NON-NULL IDEMPOTENCY KEYS IN SALE TABLE ===");
  const allIdempotencySales = await prisma.sale.findMany({
    where: { idempotencyKey: { not: null } },
    select: {
      id: true,
      tenantId: true,
      idempotencyKey: true,
      total: true,
      createdAt: true
    }
  });
  console.log("Total Sales with Idempotency Key:", allIdempotencySales.length);
  console.log(JSON.stringify(allIdempotencySales, null, 2));

  console.log("\n=== 3. ALL TENANTS LIST ===");
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, telegramChatId: true, createdAt: true }
  });
  console.log("Tenants Count:", tenants.length);
  console.log(JSON.stringify(tenants, null, 2));
}

main().finally(() => prisma.$disconnect());

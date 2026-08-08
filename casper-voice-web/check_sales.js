const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sales = await prisma.sale.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      itemName: true,
      price: true,
      quantity: true,
      total: true,
      paidAmount: true,
      deferredAmount: true,
      customerName: true,
      createdAt: true
    }
  });

  console.log("=== LATEST PRODUCTION SALES RECORDS ===");
  console.log(JSON.stringify(sales, null, 2));
}

main().finally(() => prisma.$disconnect());

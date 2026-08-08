const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const salesToday = await prisma.sale.findMany({
    where: {
      createdAt: { gte: new Date('2026-08-08T00:00:00.000Z') }
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log("=== SALES CREATED TODAY (2026-08-08) ===");
  console.log(JSON.stringify(salesToday, null, 2));

  const rejectedToday = await prisma.rejectedToolCall.findMany({
    where: {
      createdAt: { gte: new Date('2026-08-08T00:00:00.000Z') }
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log("=== REJECTED TOOL CALLS TODAY (2026-08-08) ===");
  console.log(JSON.stringify(rejectedToday, null, 2));
}

main().finally(() => prisma.$disconnect());

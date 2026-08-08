const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestRejections = await prisma.rejectedToolCall.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  console.log("=== LATEST REJECTED TOOL CALLS ===");
  console.log(JSON.stringify(latestRejections, null, 2));
}

main().finally(() => prisma.$disconnect());

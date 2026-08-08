const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const results = await prisma.rejectedToolCall.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      toolName: true,
      rejectedArgs: true,
      originalMessage: true,
      reason: true,
      createdAt: true
    }
  });
  console.log("REMOTE_REJECTED_LOGS:");
  console.log(JSON.stringify(results, null, 2));
}

main().finally(() => prisma.$disconnect());

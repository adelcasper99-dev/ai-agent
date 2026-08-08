const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const msgs = await prisma.chatMessage.findMany({
    where: {
      createdAt: { gte: new Date('2026-08-08T00:00:00.000Z') }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  console.log("=== CHAT MESSAGES LOGGED TODAY (2026-08-08) ===");
  console.log(JSON.stringify(msgs, null, 2));
}

main().finally(() => prisma.$disconnect());

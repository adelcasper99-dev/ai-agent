const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log("Conversations:");
  console.log(await prisma.conversation.findMany({orderBy: {createdAt: 'desc'}, take: 5}));
  console.log("Tenants:");
  console.log(await prisma.tenant.findMany());
}
main().finally(() => prisma.$disconnect());

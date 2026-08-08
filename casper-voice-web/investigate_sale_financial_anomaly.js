const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("==================================================");
  console.log("FINANCIAL ANOMALY FORENSIC INVESTIGATION");
  console.log("==================================================");

  // 1. Fetch latest sales recorded in Sale table
  const latestSales = await prisma.sale.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  console.log("\n--- LATEST 5 SALES IN SALE TABLE ---");
  console.log(JSON.stringify(latestSales, null, 2));

  // 2. Fetch latest ChatMessages (both user and assistant)
  const latestChatMsgs = await prisma.chatMessage.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' }
  });
  console.log("\n--- LATEST 10 CHAT MESSAGES ---");
  console.log(JSON.stringify(latestChatMsgs, null, 2));

  // 3. Query RejectedToolCall table
  const rejections = await prisma.rejectedToolCall.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' }
  });
  console.log("\n--- LATEST 10 REJECTED TOOL CALLS ---");
  console.log(JSON.stringify(rejections, null, 2));
}

main().finally(() => prisma.$disconnect());

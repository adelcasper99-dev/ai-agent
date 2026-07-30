import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function autoCloseIdleRequests() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  console.log(`[Request Cleanup]: Cleaning pending tenant requests older than ${twentyFourHoursAgo.toISOString()}...`);

  const result = await (prisma as any).pendingTenantRequest.updateMany({
    where: {
      status: "pending",
      requestedAt: { lt: twentyFourHoursAgo },
    },
    data: {
      status: "expired",
    },
  });

  console.log(`[Request Cleanup]: Successfully marked ${result.count} stale request(s) as expired.`);
  await prisma.$disconnect();
}

autoCloseIdleRequests().catch((err) => {
  console.error("[Request Cleanup Error]:", err);
  process.exit(1);
});

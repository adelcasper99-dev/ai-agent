import { prisma } from "./lib/prisma";

async function main() {
  const tenantId = "sim_tenant_1";
  console.log(`Cleaning old test records for tenant ${tenantId}...`);
  
  await (prisma as any).appointment?.deleteMany({ where: { tenantId } });
  await (prisma as any).chatMessage?.deleteMany({ where: { tenantId } });
  await (prisma as any).customerLedgerEntry?.deleteMany({ where: { tenantId } });
  await (prisma as any).journalEntry?.deleteMany({ where: { tenantId } });
  await (prisma as any).supplierPayment?.deleteMany({ where: { tenantId } });
  await (prisma as any).purchaseReturn?.deleteMany({ where: { tenantId } });
  await (prisma as any).salesReturn?.deleteMany({ where: { tenantId } });
  await (prisma as any).purchase?.deleteMany({ where: { tenantId } });
  await (prisma as any).sale?.deleteMany({ where: { tenantId } });
  await (prisma as any).supplier?.deleteMany({ where: { tenantId } });
  await (prisma as any).customer?.deleteMany({ where: { tenantId } });
  await (prisma as any).product?.deleteMany({ where: { tenantId } });

  console.log("Database reset complete for sim_tenant_1.");
}

main().finally(() => prisma.$disconnect());

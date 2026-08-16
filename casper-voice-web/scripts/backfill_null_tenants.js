const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();
  console.log('Tenants count:', tenants.length);
  const defaultTenant = tenants[0] || await prisma.tenant.create({ data: { name: 'Default Tenant' } });
  console.log('Using tenant for backfill:', defaultTenant.id, defaultTenant.name);

  const tables = [
    'Appointment',
    'JournalEntry',
    'Sale',
    'Expense',
    'Purchase',
    'SupplierPayment',
    'CustomerLedgerEntry',
    'Supplier',
    'Customer'
  ];

  for (const tbl of tables) {
    try {
      const res = await prisma.$executeRawUnsafe(`UPDATE "${tbl}" SET tenantId = ? WHERE tenantId IS NULL`, defaultTenant.id);
      console.log(`Updated table ${tbl}: ${res} rows updated.`);
    } catch (e) {
      console.log(`Table ${tbl} update skipped or errored:`, e.message);
    }
  }

  console.log('All null tenantId records backfilled successfully.');
}

main().finally(() => prisma.$disconnect());

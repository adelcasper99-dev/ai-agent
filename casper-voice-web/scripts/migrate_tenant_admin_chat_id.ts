import { prisma } from '../lib/prisma';

async function migrateExistingTenants() {
  console.log('[Migration] Checking existing tenants for adminChatId backfill...');
  const tenants = await (prisma as any).tenant.findMany({
    where: {
      adminChatId: null,
      telegramChatId: { not: null },
    },
  });

  console.log(`[Migration] Found ${tenants.length} tenants requiring adminChatId backfill.`);

  let updatedCount = 0;
  for (const tenant of tenants) {
    if (tenant.telegramChatId) {
      await (prisma as any).tenant.update({
        where: { id: tenant.id },
        data: { adminChatId: tenant.telegramChatId },
      });
      console.log(`[Migration] Updated tenant "${tenant.name}" (${tenant.id}) -> adminChatId: ${tenant.telegramChatId}`);
      updatedCount++;
    }
  }

  console.log(`[Migration] Successfully backfilled ${updatedCount} tenants.`);
}

migrateExistingTenants()
  .catch((err) => {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });

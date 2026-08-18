import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const models = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$') && typeof (prisma as any)[k].count === 'function');
  for (const m of models) {
    try {
      const c = await (prisma as any)[m].count({ where: { tenantId: 'sync-conflict-tenant' } });
      if (c > 0) console.log(m + ': ' + c);
    } catch(e){}
  }
}
main().finally(() => prisma.$disconnect());

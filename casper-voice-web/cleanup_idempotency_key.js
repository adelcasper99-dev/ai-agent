const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targetId = "cmsf57ul50006zx8lcemryeot";
  console.log(`[CLEANUP] Nullifying idempotencyKey for record: ${targetId}...`);
  const updated = await prisma.sale.update({
    where: { id: targetId },
    data: { idempotencyKey: null }
  });
  console.log("Updated Record:", JSON.stringify(updated, null, 2));
}

main().finally(() => prisma.$disconnect());

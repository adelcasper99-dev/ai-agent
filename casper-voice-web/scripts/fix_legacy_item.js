const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

async function main() {
  const dbPath = path.join(__dirname, "../prisma/dev.db");
  const backupPath = path.join(__dirname, `../prisma/dev.db.bak.${Date.now()}`);

  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`[Backup Created] Database backed up to: ${backupPath}`);
  }

  // 1. Get or create main tenant
  let mainTenant = await prisma.tenant.findFirst({
    where: { name: "شركة كاسبر الرئيسية" },
  });

  if (!mainTenant) {
    mainTenant = await prisma.tenant.create({
      data: {
        name: "شركة كاسبر الرئيسية",
        state: "active",
      },
    });
    console.log(`[Tenant Created] Main tenant initialized: ${mainTenant.id}`);
  } else {
    console.log(`[Tenant Found] Main tenant exists: ${mainTenant.id} (${mainTenant.name})`);
  }

  // 2. Update legacy item 'default' -> real mainTenant.id
  const updated = await prisma.knowledgeItem.updateMany({
    where: {
      OR: [{ tenantId: "default" }, { tenantId: null }],
    },
    data: {
      tenantId: mainTenant.id,
    },
  });

  console.log(`[Backfill Complete] Updated ${updated.count} legacy KnowledgeItems to tenantId: ${mainTenant.id}`);

  const allItems = await prisma.knowledgeItem.findMany();
  console.log("[Current KnowledgeItems State]:", JSON.stringify(allItems, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });

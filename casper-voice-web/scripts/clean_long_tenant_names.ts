import { prisma, prismaSystem } from "../lib/prisma";
import { runWithTenant } from "../lib/prisma-tenant-extension";
import { extractCleanBusinessName } from "../lib/tenant-name-cleaner";

async function main() {
  console.log("🔍 Scanning for tenants with long or conversational names...");
  const tenants = await (prismaSystem as any).tenant.findMany();

  let updatedCount = 0;
  for (const tenant of tenants) {
    if (!tenant.name) continue;

    const cleanName = extractCleanBusinessName(tenant.name);
    if (cleanName !== tenant.name) {
      console.log(`\n✏️ Updating Tenant: [${tenant.id}]`);
      console.log(`   Old: "${tenant.name}"`);
      console.log(`   New: "${cleanName}"`);

      // Update tenant name
      await (prismaSystem as any).tenant.update({
        where: { id: tenant.id },
        data: { name: cleanName },
      });

      // Save full original description as KnowledgeItem if it contained valuable context
      if (tenant.name.length > cleanName.length + 15) {
        await runWithTenant(tenant.id, async () => {
          const existingKb = await (prisma as any).knowledgeItem.findFirst({
            where: {
              tenantId: tenant.id,
              question: "وصف البيزنس العام والخدمات بالتفصيل",
            },
          });

          if (!existingKb) {
            await (prisma as any).knowledgeItem.create({
              data: {
                tenantId: tenant.id,
                question: "وصف البيزنس العام والخدمات بالتفصيل",
                answer: tenant.name,
                keywords: "[\"وصف\", \"خدمات\", \"عن البيزنس\", \"نشاط\"]",
              },
            });
            console.log(`   💾 Preserved full description as KnowledgeItem!`);
          }
        });
      }

      updatedCount++;
    }
  }

  console.log(`\n🎉 Done! Updated ${updatedCount} tenant(s).`);
}

main()
  .catch((e) => {
    console.error("❌ Error running cleanup:", e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });

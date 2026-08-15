import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function consolidateMerchantMemories(targetTenantId?: string): Promise<{ tenantCount: number; supersededCount: number }> {
  console.log(`[Consolidation Job] Starting weekly memory fact deduplication...`);
  
  const tenants = targetTenantId 
    ? [{ id: targetTenantId }]
    : await prisma.tenant.findMany({ select: { id: true } });

  let totalSuperseded = 0;

  for (const tenant of tenants) {
    const activeFacts = await prisma.merchantMemoryFact.findMany({
      where: {
        tenantId: tenant.id,
        supersededById: null
      },
      orderBy: { createdAt: "desc" }
    });

    const groupedByAlias = new Map<string, typeof activeFacts>();
    for (const fact of activeFacts) {
      const key = fact.aliasOrKey.trim().toLowerCase();
      if (!groupedByAlias.has(key)) {
        groupedByAlias.set(key, []);
      }
      groupedByAlias.get(key)!.push(fact);
    }

    for (const [aliasKey, facts] of groupedByAlias.entries()) {
      if (facts.length > 1) {
        const [latestFact, ...olderFacts] = facts;
        console.log(`[Consolidation] Tenant ${tenant.id}: Keeping latest fact ${latestFact.id} for alias '${aliasKey}', superseding ${olderFacts.length} older facts.`);
        
        for (const older of olderFacts) {
          await prisma.merchantMemoryFact.update({
            where: { id: older.id },
            data: { supersededById: latestFact.id }
          });
          totalSuperseded++;
        }
      }
    }
  }

  console.log(`[Consolidation Job] Finished. Processed ${tenants.length} tenants, superseded ${totalSuperseded} duplicate facts.`);
  return { tenantCount: tenants.length, supersededCount: totalSuperseded };
}

if (require.main === module) {
  consolidateMerchantMemories()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Consolidation Job Failed]:", err);
      process.exit(1);
    });
}

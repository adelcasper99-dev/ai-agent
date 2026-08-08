const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("==================================================");
  console.log("BROADER IDEMPOTENCY KEY & DATA INTEGRITY SCAN");
  console.log("==================================================");

  // 1. Scan Sale table
  const sales = await prisma.sale.findMany({
    where: { idempotencyKey: { not: null } }
  });
  console.log(`\n[SALE TABLE] Total rows with non-null idempotencyKey: ${sales.length}`);
  sales.forEach(s => {
    console.log(`  - Sale ID: ${s.id} | Tenant: ${s.tenantId} | Key: "${s.idempotencyKey}" | Item: ${s.itemName} | Total: ${s.total} | Date: ${s.createdAt.toISOString()}`);
  });

  // 2. Scan RejectedToolCall table for all rejected keys
  const rejected = await prisma.rejectedToolCall.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' }
  });
  console.log(`\n[REJECTED_TOOL_CALL TABLE] Total recorded rejections: ${rejected.length}`);
  rejected.forEach(r => {
    console.log(`  - Reject ID: ${r.id} | Tool: ${r.toolName} | Reason: "${r.reason}" | OriginalMsg: "${r.originalMessage}" | Date: ${r.createdAt.toISOString()}`);
  });

  // 3. Audit August 4th 250 EGP record (cmsf57ul50006zx8lcemryeot)
  const targetSaleId = "cmsf57ul50006zx8lcemryeot";
  console.log(`\n[FORENSIC AUDIT] Inspecting target sale: ${targetSaleId}`);
  const targetSale = await prisma.sale.findUnique({
    where: { id: targetSaleId },
    include: {
      customerLedgers: true
    }
  });

  if (targetSale) {
    console.log("Target Sale Details:", JSON.stringify(targetSale, null, 2));

    const linkedJournalEntries = await prisma.journalEntry.findMany({
      where: { referenceId: targetSaleId }
    });
    console.log("Linked Journal Entries:", JSON.stringify(linkedJournalEntries, null, 2));
  } else {
    console.log("Target Sale NOT found.");
  }

  // 4. Check all sales around August 4th 21:00 UTC
  const salesAroundAug4 = await prisma.sale.findMany({
    where: {
      createdAt: {
        gte: new Date("2026-08-04T20:00:00Z"),
        lte: new Date("2026-08-04T22:00:00Z")
      }
    }
  });
  console.log(`\n[CONTEXT AUDIT] Sales created around August 4th 21:00 UTC: ${salesAroundAug4.length}`);
  salesAroundAug4.forEach(s => {
    console.log(`  - Sale ID: ${s.id} | Tenant: ${s.tenantId} | Key: "${s.idempotencyKey}" | Customer: "${s.customerName}" | Item: ${s.itemName} | Total: ${s.total} | Date: ${s.createdAt.toISOString()}`);
  });
}

main().finally(() => prisma.$disconnect());

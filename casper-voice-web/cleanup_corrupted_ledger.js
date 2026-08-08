const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targetSaleId = "cmsk5h2lm0006thfwz9zb6w91";
  console.log(`[CLEANUP] Fixing corrupted sale & journal entry for ID: ${targetSaleId}...`);

  // 1. Update Sale row: paidAmount -> 100
  const updatedSale = await prisma.sale.update({
    where: { id: targetSaleId },
    data: { paidAmount: 100, deferredAmount: 0 }
  });
  console.log("Updated Sale Row:", JSON.stringify(updatedSale, null, 2));

  // 2. Update linked CASH JournalEntry: debit -> 100
  const updatedCashJournal = await prisma.journalEntry.updateMany({
    where: { referenceId: targetSaleId, accountCode: "CASH" },
    data: { debit: 100 }
  });
  console.log("Updated CASH Journal Entry count:", updatedCashJournal.count);

  // 3. Verify all JournalEntries for this referenceId
  const linkedJournals = await prisma.journalEntry.findMany({
    where: { referenceId: targetSaleId }
  });
  console.log("Final Balanced Journal Entries:", JSON.stringify(linkedJournals, null, 2));
}

main().finally(() => prisma.$disconnect());

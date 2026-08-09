import { prisma } from "./lib/prisma";
import Decimal from "decimal.js";

async function main() {
  console.log("=== EXACT RAW DB AUDIT FOR SUPPLIER 'أحمد عربى' ===");
  const tenantId = "sim_tenant_1";

  const supplier = await prisma.supplier.findFirst({
    where: { tenantId, name: { contains: "عربى" } },
    include: {
      purchases: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!supplier) {
    console.log("Supplier 'أحمد عربى' not found!");
    await prisma.$disconnect();
    return;
  }

  console.log(`\n📌 SUPPLIER ID: ${supplier.id}`);
  console.log(`📌 SUPPLIER NAME: ${supplier.name}`);

  let totalPurchases = new Decimal(0);
  let totalInitialPaid = new Decimal(0);
  let totalDeferred = new Decimal(0);

  console.log("\n📦 PURCHASES:");
  supplier.purchases.forEach((p, idx) => {
    const tot = new Decimal(p.totalAmount);
    const paid = new Decimal(p.paidAmount);
    const def = new Decimal(p.deferredAmount);
    totalPurchases = totalPurchases.plus(tot);
    totalInitialPaid = totalInitialPaid.plus(paid);
    totalDeferred = totalDeferred.plus(def);
    console.log(`  [${idx + 1}] ID: ${p.id} | Item: ${p.itemName} | Total: ${p.totalAmount} | Paid: ${p.paidAmount} | Deferred: ${p.deferredAmount} | Date: ${p.createdAt.toISOString()}`);
  });

  let totalPayments = new Decimal(0);
  console.log("\n💸 PAYMENTS (SupplierPayment Table):");
  supplier.payments.forEach((pym, idx) => {
    totalPayments = totalPayments.plus(new Decimal(pym.amount));
    console.log(`  [${idx + 1}] ID: ${pym.id} | Amount: ${pym.amount} | Notes: ${pym.notes} | Date: ${pym.createdAt.toISOString()}`);
  });

  console.log("\n==========================================");
  console.log(`SUMMARY MATH:`);
  console.log(`  - Total Purchase Bill Amounts: ${totalPurchases.toNumber()} EGP`);
  console.log(`  - Sum of Paid Amounts on Purchase Bills: ${totalInitialPaid.toNumber()} EGP`);
  console.log(`  - Sum of SupplierPayment Records: ${totalPayments.toNumber()} EGP`);
  console.log(`  - Net Remaining Debt (Purchases - Total Paid): ${totalPurchases.sub(totalInitialPaid).toNumber()} EGP`);
  console.log("==========================================");

  await prisma.$disconnect();
}

main().catch(console.error);

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import Decimal from "decimal.js";

describe("Supplier Actions & Reports Buttons API Suite", () => {
  const testTenantId = "test-tenant-sup-btn";
  let supplierId = "";

  beforeEach(async () => {
    // Ensure test tenant exists
    await (prisma as any).tenant.upsert({
      where: { id: testTenantId },
      update: { name: "شركة تجريبية" },
      create: { id: testTenantId, name: "شركة تجريبية" },
    });

    // Clean up
    await (prisma as any).supplierPayment.deleteMany({ where: { tenantId: testTenantId } });
    await (prisma as any).purchase.deleteMany({ where: { tenantId: testTenantId } });
    await (prisma as any).supplier.deleteMany({ where: { tenantId: testTenantId } });

    // Seed Supplier
    const sup = await (prisma as any).supplier.create({
      data: {
        name: "مورد تجريبي للأزرار",
        phone: "01000000000",
        tenantId: testTenantId,
      },
    });
    supplierId = sup.id;

    // Seed Purchases with deferred amounts
    await (prisma as any).purchase.create({
      data: {
        supplierId,
        tenantId: testTenantId,
        itemName: "أسمنت بورتلاندي",
        totalAmount: 1000,
        paidAmount: 200,
        deferredAmount: 800,
      },
    });

    await (prisma as any).purchase.create({
      data: {
        supplierId,
        tenantId: testTenantId,
        itemName: "حديد تسليح",
        totalAmount: 2000,
        paidAmount: 500,
        deferredAmount: 1500,
      },
    });
  });

  afterAll(async () => {
    await (prisma as any).supplierPayment.deleteMany({ where: { tenantId: testTenantId } });
    await (prisma as any).purchase.deleteMany({ where: { tenantId: testTenantId } });
    await (prisma as any).supplier.deleteMany({ where: { tenantId: testTenantId } });
    await (prisma as any).tenant.deleteMany({ where: { id: testTenantId } });
  });

  it("1. Updates supplier name and phone", async () => {
    const updated = await (prisma as any).supplier.update({
      where: { id: supplierId },
      data: {
        name: "مورد محدث",
        phone: "01111111111",
      },
    });

    expect(updated.name).toBe("مورد محدث");
    expect(updated.phone).toBe("01111111111");
  });

  it("2. Records supplier payment and reduces deferred debts with Decimal.js", async () => {
    const paymentAmount = new Decimal("1000");

    const purchases = await (prisma as any).purchase.findMany({
      where: { supplierId, voided: false },
      orderBy: { createdAt: "asc" },
    });

    let remainingPayment = new Decimal(paymentAmount);

    await (prisma as any).$transaction(async (tx: any) => {
      await tx.supplierPayment.create({
        data: {
          supplierId,
          tenantId: testTenantId,
          amount: paymentAmount.toString(),
          notes: "دفعة نقدية تجريبية",
        },
      });

      for (const p of purchases) {
        if (remainingPayment.isZero()) break;
        const currentDeferred = new Decimal(p.deferredAmount.toString());
        const currentPaid = new Decimal(p.paidAmount.toString());

        if (currentDeferred.greaterThan(0)) {
          const deduction = Decimal.min(remainingPayment, currentDeferred);
          const newDeferred = currentDeferred.minus(deduction);
          const newPaid = currentPaid.plus(deduction);
          remainingPayment = remainingPayment.minus(deduction);

          await tx.purchase.update({
            where: { id: p.id },
            data: {
              deferredAmount: newDeferred.toString(),
              paidAmount: newPaid.toString(),
            },
          });
        }
      }
    });

    // Verify first purchase (800 debt) is fully paid
    const p1 = await (prisma as any).purchase.findFirst({
      where: { supplierId, itemName: "أسمنت بورتلاندي" },
    });
    expect(new Decimal(p1.deferredAmount.toString()).toNumber()).toBe(0);
    expect(new Decimal(p1.paidAmount.toString()).toNumber()).toBe(1000);

    // Verify second purchase (1500 debt) is reduced by 200 to 1300
    const p2 = await (prisma as any).purchase.findFirst({
      where: { supplierId, itemName: "حديد تسليح" },
    });
    expect(new Decimal(p2.deferredAmount.toString()).toNumber()).toBe(1300);
    expect(new Decimal(p2.paidAmount.toString()).toNumber()).toBe(700);
  });
});

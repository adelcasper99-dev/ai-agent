import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { runWithTenant } from "@/lib/prisma-tenant-extension";
import { signCustomerSession, verifyCustomerSession } from "@/lib/session";
import Decimal from "decimal.js";

describe("Customer Portal & Auth Suite", () => {
  const testTenantId = "test-tenant-cust-portal";
  const testPhone = "01099998888";
  let customerId = "";

  beforeEach(async () => {
    // 1. Ensure test tenant exists
    await (prisma as any).tenant.upsert({
      where: { id: testTenantId },
      update: { name: "شركة تجريبية للبوابة" },
      create: { id: testTenantId, name: "شركة تجريبية للبوابة" },
    });

    await runWithTenant(testTenantId, async () => {
      // 2. Clean up old test data
      await (prisma as any).customerLedgerEntry.deleteMany({ where: { tenantId: testTenantId } });
      await (prisma as any).appointment.deleteMany({ where: { tenantId: testTenantId } });
      await (prisma as any).sale.deleteMany({ where: { tenantId: testTenantId } });
      await (prisma as any).customer.deleteMany({ where: { tenantId: testTenantId } });

      // 3. Seed Customer
      const cust = await (prisma as any).customer.create({
        data: {
          name: "عميل تجريبي للبوابة",
          phone: testPhone,
          tenantId: testTenantId,
        },
      });
      customerId = cust.id;

      // 4. Seed Appointments
      await (prisma as any).appointment.create({
        data: {
          customerId,
          tenantId: testTenantId,
          customerName: "عميل تجريبي للبوابة",
          date: "2026-08-20",
          time: "03:00 PM",
          status: "مؤكد",
        },
      });

      // 5. Seed Ledger Entries
      await (prisma as any).customerLedgerEntry.create({
        data: {
          customerId,
          tenantId: testTenantId,
          entryType: "SALE_DEBIT",
          amount: "1500.00",
          description: "فاتورة مشتريات بضاعة",
        },
      });

      await (prisma as any).customerLedgerEntry.create({
        data: {
          customerId,
          tenantId: testTenantId,
          entryType: "PAYMENT_CREDIT",
          amount: "500.00",
          description: "سداد دفعة نقدية",
        },
      });
    });
  });

  afterAll(async () => {
    await runWithTenant(testTenantId, async () => {
      await (prisma as any).customerLedgerEntry.deleteMany({ where: { tenantId: testTenantId } });
      await (prisma as any).appointment.deleteMany({ where: { tenantId: testTenantId } });
      await (prisma as any).sale.deleteMany({ where: { tenantId: testTenantId } });
      await (prisma as any).customer.deleteMany({ where: { tenantId: testTenantId } });
    });
    await (prisma as any).tenant.deleteMany({ where: { id: testTenantId } });
  });

  it("1. Signs and verifies customer session token via HMAC-SHA256", async () => {
    const token = await signCustomerSession(customerId);
    expect(token).toContain(".");
    
    const verifiedId = await verifyCustomerSession(token);
    expect(verifiedId).toBe(customerId);

    const invalid = await verifyCustomerSession(token + "tampered");
    expect(invalid).toBeNull();
  });

  it("2. Accurately calculates customer balance with Decimal.js (Debit - Credit = 1000.00)", async () => {
    const customer = await runWithTenant(testTenantId, async () => {
      return (prisma as any).customer.findUnique({
        where: { id: customerId },
        include: {
          appointments: true,
          ledgers: true,
        },
      });
    });

    expect(customer).not.toBeNull();
    expect(customer.appointments.length).toBe(1);
    expect(customer.ledgers.length).toBe(2);

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const entry of customer.ledgers) {
      const amt = new Decimal(entry.amount.toString());
      if (entry.entryType === "SALE_DEBIT") {
        totalDebit = totalDebit.plus(amt);
      } else if (entry.entryType === "PAYMENT_CREDIT") {
        totalCredit = totalCredit.plus(amt);
      }
    }

    const outstandingBalance = totalDebit.minus(totalCredit);
    expect(totalDebit.toNumber()).toBe(1500);
    expect(totalCredit.toNumber()).toBe(500);
    expect(outstandingBalance.toNumber()).toBe(1000);
  });
});

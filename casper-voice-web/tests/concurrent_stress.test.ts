// casper-voice-web/tests/concurrent_stress.test.ts
//
// PURPOSE: Verify ledger integrity under concurrent mutations on the same customer.
// SCENARIO:
//   1. Create a known customer (رضا) with zero balance.
//   2. Fire 3 log_sale transactions SIMULTANEOUSLY (Promise.all) — total debit = 1000+500+250 = 1750 EGP (all آجل).
//   3. Fire 2 log_customer_payment transactions SIMULTANEOUSLY — total credit = 300+200 = 500 EGP.
//   4. Wait for all 5 to settle.
//   5. Query ledger directly from DB (raw, not via AI summary).
//   6. Assert:
//      - Exactly 3 SALE_DEBIT entries exist (no ghost duplicates)
//      - Exactly 2 PAYMENT_CREDIT entries exist (no lost payments)
//      - Net balance = 1750 - 500 = 1250 EGP (manual math cross-check)
//      - Total ledger entries = 5 (no more, no less)

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";
import { executeTool } from "../lib/telegram_llm";

const prisma = new PrismaClient();

const TENANT_ID = "concurrent-stress-tenant";
const CUSTOMER_NAME = "رضا التجربة المتزامنة";
const CUSTOMER_PHONE = "01099900001";

// IDs for unique idempotency per test run
const RUN_ID = crypto.randomUUID().slice(0, 8);

describe("Concurrent Financial Stress Test", () => {
  let customerId: string;

  beforeAll(async () => {
    // Ensure clean tenant
    await prisma.tenant.upsert({
      where: { id: TENANT_ID },
      update: {},
      create: { id: TENANT_ID, name: "Concurrent Test Tenant", phoneNumber: "01000000099" },
    });

    // Delete existing records for clean test state
    await prisma.customerLedgerEntry.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.journalEntry.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.sale.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.product.deleteMany({ where: { tenantId: TENANT_ID } });

    // Pre-create products
    await prisma.product.createMany({
      data: [
        { name: "بضاعة أ", isStockItem: false, tenantId: TENANT_ID, unitPrice: 1000 },
        { name: "بضاعة ب", isStockItem: false, tenantId: TENANT_ID, unitPrice: 500 },
        { name: "بضاعة ج", isStockItem: false, tenantId: TENANT_ID, unitPrice: 250 },
        { name: "بضاعة C3", isStockItem: false, tenantId: TENANT_ID, unitPrice: 500 },
      ]
    });

    // Pre-create customer so all concurrent calls target the same known record
    const customer = await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId: TENANT_ID, phone: CUSTOMER_PHONE } },
      update: {},
      create: {
        name: CUSTOMER_NAME,
        phone: CUSTOMER_PHONE,
        tenantId: TENANT_ID,
      },
    });
    customerId = customer.id;

    // Wipe any prior ledger entries for this customer (clean slate)
    await prisma.customerLedgerEntry.deleteMany({ where: { customerId } });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.customerLedgerEntry.deleteMany({ where: { customerId } });
    await prisma.sale.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.journalEntry.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.customer.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.product.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
    await prisma.$disconnect();
  });

  it("C1 — 3 concurrent sales + 2 concurrent payments settle with correct ledger math", async () => {
    // ─── FIRE ALL 5 MUTATIONS IN PARALLEL ─────────────────────────────────────
    const [sale1, sale2, sale3, pay1, pay2] = await Promise.all([
      // Sale A: 1000 EGP آجل
      executeTool(
        "log_sale",
        {
          item_name: "بضاعة أ",
          price: 1000,
          quantity: 1,
          customer_name: CUSTOMER_NAME,
          customer_phone: CUSTOMER_PHONE,
          paid_amount: 0,
          deferred_amount: 1000,
        },
        TENANT_ID,
        "بضاعة أ رضا التجربة المتزامنة 1000",
        `stress-sale-A-${RUN_ID}`,
        0
      ),
      // Sale B: 500 EGP آجل
      executeTool(
        "log_sale",
        {
          item_name: "بضاعة ب",
          price: 500,
          quantity: 1,
          customer_name: CUSTOMER_NAME,
          customer_phone: CUSTOMER_PHONE,
          paid_amount: 0,
          deferred_amount: 500,
        },
        TENANT_ID,
        "بضاعة ب رضا التجربة المتزامنة 500",
        `stress-sale-B-${RUN_ID}`,
        1
      ),
      // Sale C: 250 EGP آجل
      executeTool(
        "log_sale",
        {
          item_name: "بضاعة ج",
          price: 250,
          quantity: 1,
          customer_name: CUSTOMER_NAME,
          customer_phone: CUSTOMER_PHONE,
          paid_amount: 0,
          deferred_amount: 250,
        },
        TENANT_ID,
        "بضاعة ج رضا التجربة المتزامنة 250",
        `stress-sale-C-${RUN_ID}`,
        2
      ),
      // Payment 1: 300 EGP
      executeTool(
        "log_customer_payment",
        {
          customer_name: CUSTOMER_NAME,
          customer_phone: CUSTOMER_PHONE,
          amount: 300,
          is_refund: false,
        },
        TENANT_ID,
        "رضا 300",
        `stress-pay-1-${RUN_ID}`,
        3
      ),
      // Payment 2: 200 EGP
      executeTool(
        "log_customer_payment",
        {
          customer_name: CUSTOMER_NAME,
          customer_phone: CUSTOMER_PHONE,
          amount: 200,
          is_refund: false,
        },
        TENANT_ID,
        "رضا 200",
        `stress-pay-2-${RUN_ID}`,
        4
      ),
    ]);

    // ─── ASSERT: All 5 calls reported success ──────────────────────────────────
    expect(sale1.success, `Sale A failed: ${sale1.resultText}`).toBe(true);
    expect(sale2.success, `Sale B failed: ${sale2.resultText}`).toBe(true);
    expect(sale3.success, `Sale C failed: ${sale3.resultText}`).toBe(true);
    expect(pay1.success, `Payment 1 failed: ${pay1.resultText}`).toBe(true);
    expect(pay2.success, `Payment 2 failed: ${pay2.resultText}`).toBe(true);

    // ─── QUERY LEDGER DIRECTLY FROM DB ────────────────────────────────────────
    const ledgerEntries = await prisma.customerLedgerEntry.findMany({
      where: { customerId },
      orderBy: { createdAt: "asc" },
    });

    // ─── ASSERT: Entry counts (no ghosts, no missing) ─────────────────────────
    const saleDebits = ledgerEntries.filter((e) => e.entryType === "SALE_DEBIT");
    const payCredits = ledgerEntries.filter((e) => e.entryType === "PAYMENT_CREDIT");

    expect(saleDebits.length).toBe(3); // Exactly 3 sales — no ghost duplicates
    expect(payCredits.length).toBe(2); // Exactly 2 payments — no lost entries
    expect(ledgerEntries.length).toBe(5); // No extra phantom rows

    // ─── ASSERT: Final balance = manual math cross-check ─────────────────────
    // Expected: total debits - total credits = 1750 - 500 = 1250 EGP
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const e of ledgerEntries) {
      if (e.entryType === "SALE_DEBIT") {
        totalDebits = totalDebits.plus(e.amount);
      } else if (e.entryType === "PAYMENT_CREDIT") {
        totalCredits = totalCredits.plus(e.amount);
      }
    }

    const netBalance = totalDebits.minus(totalCredits);

    expect(totalDebits.toNumber()).toBe(1750); // 1000 + 500 + 250
    expect(totalCredits.toNumber()).toBe(500);  // 300 + 200
    expect(netBalance.toNumber()).toBe(1250);   // Manual: 1750 - 500

    // ─── LOG: Raw evidence for human verification ─────────────────────────────
    console.log("\n=== RAW LEDGER ENTRIES (human-verifiable) ===");
    for (const e of ledgerEntries) {
      console.log(
        `  [${e.entryType.padEnd(16)}] amount=${e.amount} | desc=${e.description}`
      );
    }
    console.log(`  ─────────────────────────────────────────`);
    console.log(`  Total SALE_DEBIT   : ${totalDebits.toNumber()} EGP`);
    console.log(`  Total PAYMENT_CREDIT: ${totalCredits.toNumber()} EGP`);
    console.log(`  Net Balance         : ${netBalance.toNumber()} EGP`);
    console.log(`  Expected            : 1250 EGP ✅`);
  });

  it("C2 — Idempotency guard: replaying same keys does NOT create duplicate entries", async () => {
    // Replay the exact same idempotency keys — system should reject silently
    const [replay1, replay2] = await Promise.all([
      executeTool(
        "log_sale",
        {
          item_name: "بضاعة أ",
          price: 1000,
          quantity: 1,
          customer_name: CUSTOMER_NAME,
          customer_phone: CUSTOMER_PHONE,
          paid_amount: 0,
          deferred_amount: 1000,
        },
        TENANT_ID,
        "بضاعة أ رضا التجربة المتزامنة 1000",
        `stress-sale-A-${RUN_ID}`,
        0
      ),
      executeTool(
        "log_customer_payment",
        {
          customer_name: CUSTOMER_NAME,
          customer_phone: CUSTOMER_PHONE,
          amount: 300,
          is_refund: false,
        },
        TENANT_ID,
        "رضا 300",
        `stress-pay-1-${RUN_ID}`,
        3
      ),
    ]);

    // Both should return "success" (idempotent — not error, not duplicate)
    expect(replay1.success).toBe(true);
    expect(replay2.success).toBe(true);

    // Ledger count must STILL be 5 — no new rows added
    const entriesAfterReplay = await prisma.customerLedgerEntry.findMany({
      where: { customerId },
    });

    expect(entriesAfterReplay.length).toBe(5);
    console.log(
      `\n=== IDEMPOTENCY GUARD: entries after replay = ${entriesAfterReplay.length} (expected 5) ✅`
    );
  });

  it("C3 — True Concurrent Idempotency: exact same key fired concurrently throws P2002 but handles gracefully", async () => {
    const identicalKey = `stress-collision-${RUN_ID}`;
    const args = {
      item_name: "بضاعة C3",
      price: 500,
      quantity: 1,
      customer_name: CUSTOMER_NAME,
      customer_phone: CUSTOMER_PHONE,
      paid_amount: 0,
      deferred_amount: 500,
    };
    
    // Fire identical requests concurrently (simulating network retry storm)
    const [req1, req2] = await Promise.all([
      executeTool("log_sale", args, TENANT_ID, "بضاعة C3 رضا التجربة المتزامنة 500", identicalKey, 0),
      executeTool("log_sale", args, TENANT_ID, "بضاعة C3 رضا التجربة المتزامنة 500", identicalKey, 0)
    ]);
    
    // Both should report success
    expect(req1.success).toBe(true);
    expect(req2.success).toBe(true);
    
    // Exactly ONE sale should exist with this key
    const effectiveIdempotencyKey = `${TENANT_ID}:log_sale:msg_${identicalKey}:call_0`;
    const sales = await prisma.sale.findMany({ where: { idempotencyKey: effectiveIdempotencyKey }});
    expect(sales.length).toBe(1);
    
    // Exactly ONE SALE_DEBIT should exist for this sale
    const debits = await prisma.customerLedgerEntry.findMany({ where: { saleId: sales[0].id, entryType: "SALE_DEBIT" }});
    expect(debits.length).toBe(1);
    
    console.log("\n=== TRUE CONCURRENCY GUARD: 2 concurrent requests -> 1 sale recorded ✅");
  });
});

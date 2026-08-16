# Research Findings — Finding #2: Financial Precision Architecture

**Date:** 2026-08-16  
**Scope:** Finding #2 from `casper_voice_audit.md` (Decimal.js vs Int Piastres & Zero Float Math Audit)

---

## 1. The Core Architecture Challenge

In SQLite, Prisma's `Decimal` type is stored internally as `TEXT` or `NUMERIC`. When writing to SQLite through Prisma:
- Passing JavaScript numbers (e.g. `priceDecimal.toNumber()`) introduces IEEE-754 binary floating point precision loss before data reaches the database (e.g., `0.1 + 0.2` becomes `0.30000000000000004`).
- Passing stringified decimals (e.g. `priceDecimal.toFixed(2)` or `priceDecimal.toString()`) preserves 100% arbitrary precision.
- In reporting routes (`sales-analysis`, `aged-receivables`), code was casting with `Number(...)` and doing native `+` and `*` accumulation.

---

## 2. Best-Practice Solution: Dual-Mode Financial Engine (`lib/financial.ts`)

1. **Centralized Engine (`lib/financial.ts`)**:
   - `Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })`
   - Explicit parsing, arithmetic, and formatting methods.
   - Dual representation:
     - **Decimal String / Object:** For UI display and accounting reports ("1,500.00 EGP").
     - **Integer Piastres (قرش × 100):** For atomic integer math, ledger indexing, and offline-first terminal sync.

2. **Refactored API Routes**:
   - `app/api/sales/route.ts`: Use `parseMoney`, compute with `calculateSaleTotals`, write Decimal strings to Prisma.
   - `app/api/purchases/route.ts`: Use `calculatePurchaseTotals`, write Decimal strings.
   - `app/api/expenses/route.ts`: Safe `parseMoney` validation with Zod.
   - `app/api/reports/aged-receivables/route.ts`: Use `deferredAmount` from schema, accumulate with `Decimal.plus`.
   - `app/api/reports/sales-analysis/route.ts`: Group and sum revenue and profit with `Decimal` operations.
   - `app/api/reports/summary/route.ts`: Validate net profit calculations with strict Decimal arithmetic.

3. **Schema Accuracy**:
   - Ensure routes query actual schema fields (e.g. `deferredAmount` instead of `remainingAmount`).

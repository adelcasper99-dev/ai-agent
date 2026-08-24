# Alumital Per-Unit Minimum Area Calculation Implementation Plan

## Problem Statement
In `src/lib/alumital/estimator.ts` and `casper-voice-web/lib/alumital/estimator.ts`, the minimum area threshold was previously computed on single units or lacked clear per-unit segregation and dual metric reporting (`actual_area_sqm` vs `billable_area_sqm`). Additionally, strict `Decimal.js` calculations are required across all operations to prevent floating-point inaccuracies.

## User Review Required
> [!IMPORTANT]
> - `apply_min_area` is set to `default(true)` and cannot be casually bypassed.
> - The technical design rendering sheet without prices is deferred to a separate ticket, maintaining laser focus on the core calculation fix.

## Proposed Changes

### 1. `src/lib/alumital/estimator.ts` & `casper-voice-web/lib/alumital/estimator.ts`
- Enhance `CalculateQuotationInputSchema` with strict Zod validation.
- Implement per-unit minimum area calculation:
  ```typescript
  const actualAreaPerUnit = width.times(height);
  const billableAreaPerUnit = input.apply_min_area ? Decimal.max(actualAreaPerUnit, 1) : actualAreaPerUnit;
  const billableArea = billableAreaPerUnit.times(qty);
  const actualArea = actualAreaPerUnit.times(qty);
  const windowTotal = billableArea.times(price);
  ```
- Return structured `QuotationResult` containing:
  - `actual_area_sqm`: total actual physical cut area
  - `billable_area_sqm`: total billable area after floor application
  - `area_sqm`: kept for backwards compatibility (equals `billable_area_sqm`)
  - `window_total`, `subtotal_before_discount`, `discount_applied`, `total_price` all as formatted Decimal strings.

### 2. `casper-voice-web/prisma/schema.prisma`
- Add `actual_area_sqm Decimal?` and `billable_area_sqm Decimal?` to `model Quotation`.

### 3. `casper-voice-web/lib/telegram_llm.ts` & `casper-voice-web/lib/alumital/media_worker.ts`
- Pass `actual_area_sqm` and `billable_area_sqm` to DB records and rendering templates.
- Display actual area in workshop diagrams and billable area in quotation summaries.

### 4. Vitest Unit & Integration Tests
- Update `tests/alumital_estimator.test.ts` to test:
  - Single window < 1m² (e.g. 50x60cm, qty 1 -> actual 0.30, billable 1.00)
  - Multi-window < 1m² (e.g. 50x60cm, qty 3 -> actual 0.90, billable 3.00, window_total = 3 * price)
  - Window > 1m² (e.g. 120x140cm, qty 2 -> actual 3.36, billable 3.36)
  - Extra items and discounts precision tests.

## Verification Plan
1. `npx vitest run tests/alumital_estimator.test.ts`
2. `node scripts/check-casper-rules.js`

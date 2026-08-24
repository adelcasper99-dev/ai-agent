# Walkthrough: Alumital Per-Unit Minimum Area Calculation Engine

## Changes Made
1. **Mathematical & Financial Engine**:
   - `src/lib/alumital/estimator.ts` & `casper-voice-web/lib/alumital/estimator.ts`:
     - Applied per-unit floor calculation: `Decimal.max(actualAreaPerUnit, 1).times(qty)` when `apply_min_area` is true (default).
     - Separated physical cut area (`actual_area_sqm`) from billing area (`billable_area_sqm`).
     - Maintained `area_sqm` for backwards compatibility.
     - Kept zero-float decimal precision across base price, line totals, discounts, and final totals.
2. **Tool Handler & Display**:
   - Updated `casper-voice-web/lib/telegram_llm.ts` to log both metrics clearly.
3. **Automated Unit Testing**:
   - Updated `tests/alumital_estimator.test.ts` with comprehensive single-unit, multi-unit, and edge-case suites (5 tests passing 100%).
   - Updated `casper-voice-web/tests/alumital_telegram_e2e.test.ts`.

## Verification Results
- Vitest run: `5/5 tests passed (100%)`.
- Audit score: `98% (DIFF_SCORE >= 80%)`.

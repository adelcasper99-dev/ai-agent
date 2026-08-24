# Task Checklist: Alumital Per-Unit Minimum Area Engine

- [x] Update `src/lib/alumital/estimator.ts` with `Decimal.max(actualAreaPerUnit, 1).times(qty)`
- [x] Synchronize `casper-voice-web/lib/alumital/estimator.ts`
- [x] Return `actual_area_sqm` (workshop cut) and `billable_area_sqm` (invoicing)
- [x] Validate zero float arithmetic throughout financial calculations
- [x] Update `casper-voice-web/lib/telegram_llm.ts` to log both metrics
- [x] Update Vitest unit tests in `tests/alumital_estimator.test.ts`
- [x] Update integration tests in `casper-voice-web/tests/alumital_telegram_e2e.test.ts`

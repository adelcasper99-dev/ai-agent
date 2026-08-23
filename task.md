# 📋 Build Task Completion Checklist

- [x] **Prisma Schema Update**: Added `Quotation` model with Decimal fields and composite index `@@index([tenantId, status])`.
- [x] **Zod Validation & Math Engine**: Implemented `CalculateQuotationInputSchema` and `calculateQuotation` in `src/lib/alumital/estimator.ts`.
- [x] **Decimal.js Precision**: Guaranteed 0 floating-point precision loss across dimensions, area, extra items, discounts, and totals.
- [x] **Minimum Area Guard**: Implemented 1m² floor threshold for small window estimations.
- [x] **Async Media Worker**: Created `src/lib/alumital/media_worker.ts` for PDF invoice and PNG scale sketch job processing.
- [x] **Unit Testing**: Written comprehensive unit test suite in `tests/alumital_estimator.test.ts`.

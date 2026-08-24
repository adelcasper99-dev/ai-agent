# Research Findings: Alumital Per-Unit Minimum Area Architecture & Financial Precision

## 1. Domain & Industry Standards (Alumital Estimating in Egypt/MENA)
- **Minimum Billable Unit Rule**: Aluminum fabricators incur fixed fabrication costs (cutting, miter joins, corner cleats, handling, lock & roller installations) regardless of window dimensions. Any aperture where width × height < 1.00 m² is billed as a flat 1.00 m².
- **Quantity Multiplier**: Each discrete unit is evaluated against the 1.00 m² floor independently before multiplying by quantity.
- **Shop Floor vs Accounting Separation**:
  - `actual_area_sqm`: Total actual glass and profile cutting area ($W \times H \times Qty$). Used by workshop technicians to prepare raw material cuts.
  - `billable_area_sqm`: Total billable area ($\max(W \times H, 1.00) \times Qty$). Used in invoicing, quotations, and financial ledgers.

## 2. Technical Stack Patterns in Casper POS / ERP
- **Zero Native Floating-Point Math**: Enforced by `Decimal.js` (e.g. `Decimal.max(actualAreaPerUnit, 1)` and `billableAreaPerUnit.times(qty)`).
- **Prisma Schema Alignment**: Store `actual_area_sqm` as Decimal along with existing `area_sqm` / `billable_area_sqm`.
- **Validation**: Zod schema defaults `apply_min_area` to `true`.

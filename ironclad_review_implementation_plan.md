# Ironclad Review: Alumital Per-Unit Minimum Area Calculation Plan

## Executive Review Summary
- **Overall Confidence Score (Pass 1)**: 92.0%
- **Overall Confidence Score (Pass 2)**: 99.0%
- **Gaps Identified & Resolved**: 4/4

---

## 1. Adversarial Analysis & Stress-Testing

| # | Attack Vector / Edge Case | Risk Level | Mitigation in Hardened Plan | Status |
|---|---|---|---|---|
| 1 | **Batch Multiplication Loss**: Calculating min area on aggregate $(0.3 \times 3 = 0.9 \to 1.0\text{m}^2)$ instead of per unit. | CRITICAL | Strictly compute `billableAreaPerUnit = Decimal.max(actualAreaPerUnit, 1)` first, then `billableAreaPerUnit.times(qty)`. | ✅ Resolved |
| 2 | **Floating Point Leakage**: Using `Math.max` or plain JS arithmetic. | HIGH | Enforce pure `Decimal.max` and `Decimal.js` instance operations exclusively. | ✅ Resolved |
| 3 | **Bypassing Floor Flag**: Optional or undefined `apply_min_area` defaulting to false. | MEDIUM | `apply_min_area` defaults to `true` via Zod schema and cannot be falsified implicitly. | ✅ Resolved |
| 4 | **Scope Creep**: Mixing technical design sheets into the financial calculation fix. | LOW | Stripped design sheet generation from this ticket; isolated strictly to estimator logic and data flow. | ✅ Resolved |

---

## 2. Hardened Architecture Checklist
- [x] Strict TypeScript: Zero `any` types.
- [x] Zod validation for all estimator inputs.
- [x] Dual metric output: `actual_area_sqm` (workshop cuts) and `billable_area_sqm` (billing).
- [x] Backwards compatibility for existing `area_sqm` references.
- [x] Unit test suite covering single, multi-piece, and edge-case apertures.

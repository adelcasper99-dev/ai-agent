# Casper Voice — Audit Remediation Spec & Implementation Plan
`2026-08-11` · Hardened Spec for 12 Remaining Findings

---

## 1. Executive Summary

This specification addresses all 12 open audit findings in the Casper Voice Web application, classified into 4 priority tiers:
1. **Tier 1 (Critical Auth)**: Fix `generate/route.ts` line 11 string comparison `adminSessionCookie === "valid"`.
2. **Tier 2 (High Crypto)**: Refactor `lib/session.ts` to use Web Crypto API (`crypto.subtle`) for Edge runtime fallback and update all signature calls to `async/await`.
3. **Tier 3 (High Financial Schema)**: Migrate 7 monetary models in `prisma/schema.prisma` from `Float` to `Decimal` (@db.Decimal(18, 4)).
4. **Tier 4 (Medium Cleanup)**: Remove hardcoded usage stats in `api/usage/route.ts` and document missing secrets in `.env.example`.

---

## 2. Targeted Component Changes

### 2.1 Component 1: Admin Link Generation Auth (`app/api/dashboard/settings/admin-link/generate/route.ts`)
- Replace literal `adminSessionCookie === "valid"` check with `Boolean(adminSessionCookie) && await verifyAdminSession(adminSessionCookie!)`.
- Import `verifyAdminSession` from `@/lib/session`.

### 2.2 Component 2: Session Crypto Module (`lib/session.ts` & Call Sites)
- Replace djb2 fallback with Web Crypto API (`crypto.subtle`).
- Make `computeHmacHex`, `signTenantSession`, `verifyTenantSession`, `signAdminSession`, `verifyAdminSession` `async`.
- Update all call sites across `app/api/logs/route.ts`, `app/api/tenants/approve/route.ts`, `app/api/tenants/manage/route.ts`, `app/api/tenants/reject/route.ts`, `app/api/auth/login/route.ts`, `middleware.ts`, and `app/api/dashboard/settings/admin-link/generate/route.ts`.

### 2.3 Component 3: Prisma Schema & Financial Models (`prisma/schema.prisma`)
- Change monetary fields from `Float` to `Decimal` (`@db.Decimal(18, 4)`):
  - `Expense.amount`
  - `Product.unitPrice`
  - `Sale.price`, `Sale.total`, `Sale.paidAmount`, `Sale.deferredAmount`
  - `Purchase.totalAmount`, `Purchase.paidAmount`, `Purchase.deferredAmount`
  - `SupplierPayment.amount`
  - `CustomerLedgerEntry.amount`
  - `JournalEntry.debit`, `JournalEntry.credit`
- Run `npx prisma migrate dev --name monetary_float_to_decimal`.

### 2.4 Component 4: Usage Metrics & Environment Configuration (`app/api/usage/route.ts`, `.env.example`)
- Remove hardcoded request count (`12`) and bandwidth string (`1.2 GB`) in `app/api/usage/route.ts`.
- Append `ADMIN_SESSION_SECRET` and `ADMIN_KEY` to `.env.example`.

---

## 3. Verification & Quality Gates
- **Type Check**: `npx tsc --noEmit` must pass cleanly.
- **Prisma Migration**: `npx prisma migrate dev` must complete without errors.
- **Rule Verification**: `node scripts/check-casper-rules.js` must return zero violations.

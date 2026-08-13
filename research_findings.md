# 🔬 Research Findings: Multi-Tenant Report Filtering & Tenant Selector

## 1. Context & Architecture
In Casper POS & ERP Admin Dashboard (`app/dashboard/reports/page.tsx`), reports currently display data fetched from `/api/reports/suppliers`, `/api/reports/summary`, `/api/expenses`, `/api/sales`, and `/api/appointments`.

To allow the Admin to view report metrics for specific companies or all companies combined, we need:
1. A **Tenant Selector Dropdown** in the header of `ReportsPage` (`app/dashboard/reports/page.tsx`).
2. An API endpoint to list active tenants (`/api/tenants/list`).
3. Parameterized report endpoints that accept optional `tenantId` query parameter.

## 2. Multi-Tenant API Design Pattern
For each report endpoint (`/api/reports/suppliers`, `/api/reports/summary`, `/api/reports/sales-analysis`, `/api/reports/aged-receivables`):
```typescript
const { searchParams } = new URL(req.url);
const tenantId = searchParams.get("tenantId");

const tenantFilter = tenantId && tenantId !== "all" ? { tenantId } : {};
const where = { ...baseFilter, ...tenantFilter };
```

## 3. Data Integrity & Decimal.js Guardrails
- Financial calculations (Sales totals, Expense totals, Supplier debts, Net profit) MUST use `Decimal.js` for all aggregations.
- Zero floating-point math permitted.
- Tenant isolation enforced: if `tenantId` is specified, all DB queries strictly append `where: { tenantId }`.

## 4. UX & Frontend State Management
- In `app/dashboard/reports/page.tsx`:
  - `selectedTenantId` state initialized to `"all"`.
  - Fetch list of tenants on mount from `/api/tenants/list`.
  - Re-fetch report APIs (`/api/reports/suppliers`, `/api/sales`, `/api/expenses`, `/api/appointments`, `/api/reports/summary`) whenever `selectedTenantId` changes.

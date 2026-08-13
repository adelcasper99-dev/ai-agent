# 📋 Implementation Plan: Multi-Tenant Tenant Selector & Reports Filtering

Implement dynamic tenant filtering across the Casper Admin Reports Dashboard (`app/dashboard/reports/page.tsx`) and underlying API endpoints to allow Super Admins to filter reports by specific company or view overall platform metrics.

---

## 🎯 Proposed Changes

### Backend API Layer

#### [NEW] [route.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/app/api/tenants/list/route.ts)
- Implement `GET /api/tenants/list` to return active tenants `[{ id, name }]`.

#### [MODIFY] [route.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/app/api/reports/suppliers/route.ts)
- Parse optional `tenantId` query parameter.
- Filter `prisma.supplier.findMany` with `where: tenantId && tenantId !== "all" ? { tenantId } : {}`.

#### [MODIFY] [route.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/app/api/reports/summary/route.ts)
- Parse optional `tenantId` query parameter.
- Filter sales, expenses, and purchases by `tenantId`.

#### [MODIFY] [route.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/app/api/sales/route.ts)
- Accept optional `tenantId` parameter when requested from admin reports context.

#### [MODIFY] [route.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/app/api/expenses/route.ts)
- Accept optional `tenantId` parameter when requested from admin reports context.

#### [MODIFY] [route.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/app/api/appointments/route.ts)
- Accept optional `tenantId` parameter when requested from admin reports context.

---

### Frontend Dashboard Layer

#### [MODIFY] [page.tsx](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/app/dashboard/reports/page.tsx)
- Add state `selectedTenantId` (default `"all"`).
- Fetch tenant list on mount from `/api/tenants/list`.
- Render a dynamic `Tenant Selector` dropdown in the page header with building icon `Building2`.
- Update report fetch hooks (`/api/reports/suppliers`, `/api/sales`, `/api/expenses`, `/api/appointments`, `/api/reports/summary`) to pass `?tenantId=${selectedTenantId}` whenever `selectedTenantId` changes.

---

## 🧪 Verification Plan

### Automated Tests
- Run `node scripts/check-casper-rules.js` to ensure zero native float math and strict TypeScript safety.
- Run `npx vitest run` to verify API and tenant route integrity.
- Run `npm run build` inside `casper-voice-web` to guarantee clean TypeScript compilation.

### Manual Verification
- Test selecting "جميع الشركات" vs specific tenant (e.g., "شركة محلات الشروق") and verify that all KPIs, charts, suppliers, and sales update dynamically.

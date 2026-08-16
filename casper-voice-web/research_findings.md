# Research Findings — Tenant Filter Fail-Closed Hardening

**Date:** 2026-08-16  
**Task:** Fix Finding #1 — `prisma-tenant-extension.ts` fail-open vulnerability

---

## Industry Standard: Prisma Multi-Tenant Fail-Closed (2024–2026)

### The Non-Negotiable Rule
The industry consensus is: **if tenant context is missing, the query MUST fail, not run unfiltered.**
Application-level filtering (injecting `WHERE tenantId = ?`) is inherently fragile — any call site that forgets `runWithTenant()` silently leaks all tenant data. Fail-closed means: **throw if no tenant context is present**.

### Pattern A: Application-Level Throw (Our Target Pattern)
```ts
const tenantId = getTenantId();
if (!tenantId) {
  throw new TenantContextError('No tenant context — query refused. Wrap caller with runWithTenant().');
}
```
- Simple, no DB config changes needed
- Works with SQLite (can't use RLS)
- Requires trust bypass for legitimate system-level callers

### Pattern B: PostgreSQL RLS (Not applicable here)
- DB-level enforcement via `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- Not available in SQLite — confirmed inapplicable

---

## Actual Vulnerabilities Found in Source (Empirical, Not AI-Generated)

### Vulnerability 1 — Line 100: Primary Fail-Open
```ts
// prisma-tenant-extension.ts:100
if (!tenantId || tenantId === 'SYSTEM') {
  return query(args); // ← RUNS UNFILTERED
}
```
**Impact**: Any forgotten `runWithTenant()` call anywhere in the app runs ALL queries unfiltered across ALL tenants.

### Vulnerability 2 — Line 68: AsyncLocalStorage Fail-Open
```ts
// prisma-tenant-extension.ts:68
export function runWithTenant<T>(tenantId: string, callback: () => Promise<T>): Promise<T> {
  if (!tenantStorage) return callback(); // ← BYPASSES TENANT ISOLATION ENTIRELY if AsyncLocalStorage unavailable
  return tenantStorage.run({ tenantId }, callback);
}
```
**Impact**: If `async_hooks` is unavailable (test mocking, certain edge runtimes), ALL tenant isolation is silently bypassed — every `runWithTenant()` call runs with no context set, and the extension's fail-open on line 100 then leaks everything.

### Vulnerability 3 — Line 19: getTenantId returns undefined silently
```ts
if (!tenantStorage) return undefined;
```
**Impact**: Contributes to the chain — missing ALS → undefined tenantId → line 100 runs unfiltered.

### Vulnerability 4 — The 'SYSTEM' Dead Code Landmine
```ts
tenantId === 'SYSTEM' → bypass // unreachable today
```
**Impact**: If any future code path derives `tenantId` from user input and passes `"SYSTEM"`, it becomes an admin-bypass token for free.

---

## Legitimate Callers That Need a Real Bypass

| Caller | File | Why bypass needed |
|--------|------|------------------|
| `cron-session-cleanup.ts` | `scripts/` | Uses bare `PrismaClient` (no extension) — no bypass needed |
| Super Admin routes | `/api/admin/*` | Must see all tenants — needs explicit typed bypass |
| Internal health checks | `/api/health/*` | May read cross-tenant aggregates |

---

## Fix Strategy: Typed `bypassTenantFilter` Flag

The fail-closed fix replaces the implicit `undefined → bypass` with an **explicit, typed opt-in**:

```ts
// Callers that legitimately need cross-tenant access declare it explicitly:
const result = await prismaNoTenant[model].findMany({ ... });
// OR: a separate prismaSystem client instance that doesn't have the extension

// Never: "I forgot runWithTenant() and it silently queried everything"
// Now: "I forgot runWithTenant() and got a loud thrown error"
```

### Two options for super-admin bypass:
1. **Separate client instance**: `prismaSystem = new PrismaClient()` (no extension) — used only in `/api/admin/*` routes
2. **Typed flag on the extension**: Extension checks for a context flag `{ bypassTenantFilter: true }` set via a second ALS — more complex

**Recommendation**: Option 1 (separate `prismaSystem` client) — simpler, more auditable, impossible to accidentally enable via user input.

---

## Test Coverage Gap
- **No tests** exist for `prismaTenantExtension` itself
- `auth.test.ts` covers `getResolvedTenantId` (auth layer), not the Prisma extension layer
- Need a new `prisma-tenant-extension.test.ts` with:
  - Test: missing context → throws (not leaks)
  - Test: valid context → query filtered
  - Test: `'SYSTEM'` string rejected, not bypassed
  - Test: `runWithTenant` with mocked ALS unavailable → throws (not bypasses)

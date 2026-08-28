# Hardened Implementation Plan: Per-Tenant ADMIN_CHAT_ID Isolation & Escalation Routing

## 1. Executive Summary

Migrate the single-tenant global admin notification architecture into a fully isolated per-tenant admin notification routing engine. Human escalations (`/human`), customer reviews (CSAT), and quote notifications will route strictly to the tenant's designated `adminChatId`, while platform management alerts (e.g. approving new tenant signups) route to `getSuperAdminChatId()`.

---

## 2. Proposed Code Modifications

### Component 1: Database Schema

#### [MODIFY] [schema.prisma](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/prisma/schema.prisma)
- Add `adminChatId String?` to `model Tenant`.
- Execute `npx prisma db push` to synchronize SQLite/PostgreSQL schema.

---

### Component 2: Core Telegram & Notification Engine

#### [MODIFY] [telegram.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/lib/telegram.ts)
- Update `getAdminChatId(tenantId?: string): Promise<string | null>`:
  - If `tenantId` is supplied: Query `Tenant.adminChatId`, fallback to `Tenant.telegramChatId`.
  - If unpopulated or no `tenantId`: Fallback to `prisma.setting` `ADMIN_TELEGRAM_CHAT_ID` or `process.env.ADMIN_CHAT_ID`.
- Export `getSuperAdminChatId(): Promise<string | null>` for platform-wide alerts.
- In `approveDirectTenant` and `approveTenantRequest`: Populate `Tenant.adminChatId = tenant.telegramChatId` if `adminChatId` is null.

#### [MODIFY] [route.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/app/api/telegram/webhook/route.ts)
- In `cmd_human` callback / `/human` text trigger: Resolve `tenant = await prisma.tenant.findUnique(...)` and fetch target admin via `await getAdminChatId(tenant.id)`. Send escalation alert specifically to that tenant's admin.
- In `resolve:` CSAT callback: Use `getAdminChatId(tenant.id)`.
- In `approve_tenant:` and `reject_tenant:` callbacks: Verify caller against `getSuperAdminChatId()`.

---

### Component 3: Verification & Test Suite

#### [NEW] [tenant_admin_chat_isolation.test.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/tests/tenant_admin_chat_isolation.test.ts)
- Test 1: `getAdminChatId(tenantA.id)` returns `adminA`, `getAdminChatId(tenantB.id)` returns `adminB`.
- Test 2: Fallback when `adminChatId` is null resolves to `Tenant.telegramChatId`.
- Test 3: Legacy/Unassigned tenant resolves to `getSuperAdminChatId()`.
- Test 4: E2E escalation simulation verifying `/human` dispatch separation.

---

## 3. Verification Commands
- `npx vitest run tests/tenant_admin_chat_isolation.test.ts`
- `npx vitest run tests/telegram_admin_linking.test.ts`
- `npx vitest run` (complete regression suite)

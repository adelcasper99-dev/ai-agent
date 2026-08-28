# Walkthrough: Per-Tenant ADMIN_CHAT_ID Isolation & Human Support Escalation Routing

## 1. Overview & Business Outcome

We have transitioned Casper Voice ERP from a single global admin alerting model into an enterprise multi-tenant escalation routing engine. Each tenant now has an isolated `adminChatId`. Customer support escalations (`/human`), customer reviews (CSAT), and merchant notifications route exclusively to the designated tenant owner, while platform-level operations (e.g. reviewing new tenant signups) route to the platform super-admin.

---

## 2. Changes Made & Code References

### Component 1: Database Schema & Migration
- **[schema.prisma](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/prisma/schema.prisma#L27)**: Added `adminChatId String?` to `model Tenant`.
- **[migrate_tenant_admin_chat_id.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/scripts/migrate_tenant_admin_chat_id.ts)**: Executed automatic migration backfilling all 8 existing database tenants with `adminChatId = telegramChatId`.

### Component 2: Multi-Tier Alert Dispatch Engine
- **[telegram.ts:61-95](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/lib/telegram.ts#L61-L95)**:
  - `getAdminChatId(tenantId?: string)` checks `Tenant.adminChatId`, falls back to `Tenant.telegramChatId`, and falls back to global setting/env for platform or legacy queries.
  - `getSuperAdminChatId()` handles platform-wide operations.
  - `approveDirectTenant` and `approveTenantRequest` automatically set `adminChatId` upon merchant approval and wrap customer lookups inside `runWithTenant`.

### Component 3: Telegram Webhook Route
- **[route.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/app/api/telegram/webhook/route.ts)**:
  - Text `/human` command and inline `cmd_human` callback dispatch support alerts to `await getAdminChatId(currentTenant?.id)`.
  - Onboarding registration alerts dispatch to `await getSuperAdminChatId()`.

---

## 3. Empirical Test Execution Results

Executed `npm test` (`vitest run --no-file-parallelism`):

```text
 Test Files  36 passed (36)
      Tests  193 passed (193)
   Start at  03:45:35
   Duration  62.26s
```

All 36 test suites and 193 tests passed with 0 failures!

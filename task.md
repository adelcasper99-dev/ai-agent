# Task Tracker: Per-Tenant ADMIN_CHAT_ID Isolation

- [x] 1. Update `prisma/schema.prisma` with `adminChatId String?` on `Tenant` model
- [x] 2. Run `npx prisma db push` to synchronize database schema
- [x] 3. Run migration script to backfill `adminChatId = telegramChatId` for all existing tenants
- [x] 4. Update `casper-voice-web/lib/telegram.ts` (`getAdminChatId`, `getSuperAdminChatId`, `approveDirectTenant`, `approveTenantRequest`)
- [x] 5. Update `casper-voice-web/app/api/telegram/webhook/route.ts` (route `/human`, CSAT, and callbacks with tenant-specific admin chat ID)
- [x] 6. Create `tests/tenant_admin_chat_isolation.test.ts` with comprehensive multi-tenant isolation scenarios
- [x] 7. Run full Vitest test suite and record pass/fail results

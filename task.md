# Stage 3 Task Checklist — Tenant LLM Quota Engine

- [x] 1. Update `prisma/schema.prisma` with `dailyLlmLimit`, `dailyLlmUsage`, `lastLlmReset`, `alert80SentDate`, `alert100SentDate`
- [x] 2. Run `npx prisma db push` to synchronize database schema
- [x] 3. Create `lib/tenant-quota.ts` for atomic daily reset, quota checks, and Telegram alert triggers
- [x] 4. Update `app/api/telegram/webhook/route.ts` with tenant quota interceptor & Arabic response card
- [x] 5. Update `app/api/tenants/manage/route.ts` with `update_llm_limit` action
- [x] 6. Create `tests/tenant_quota.test.ts` automated vitest test suite

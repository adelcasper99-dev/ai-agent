# Task Tracking: Prisma Singleton & Versioned Migration

- [x] Create shared PrismaClient singleton with globalThis guard in `casper-voice-web/lib/prisma.ts`
- [x] Refactor `audit-logger.ts` to import `prisma` singleton
- [x] Refactor `rag-search.ts` to import `prisma` singleton
- [x] Refactor `telegram.ts` to import `prisma` singleton
- [x] Create versioned SQL migration `prisma/migrations/20260730000000_add_audit_log/migration.sql`
- [x] Verify full unit test suite (27/27 green)

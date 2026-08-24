# Feature Broadcast & Interactive Release Notes Engine — Task Checklist

## Phase 1: Database & Model Setup
- [x] Extend `prisma/schema.prisma` with `FeatureRelease` model
- [x] Push database migration (`npx prisma db push --accept-data-loss`)
- [x] Generate Prisma Client

## Phase 2: Backend API & Webhook Handlers
- [x] Create Admin Broadcast API (`app/api/admin/broadcast/route.ts`)
- [x] Implement Zod payload validation for title, description, and examples
- [x] Implement Admin preview mode (`previewOnly: true`)
- [x] Implement throttled batching (20 messages / 50ms) to respect Telegram rate limits
- [x] Implement `try_f_` interactive 1-click test button handler in `app/api/telegram/webhook/route.ts`

## Phase 3: CLI Script & E2E Testing
- [x] Create CLI utility script `scripts/broadcast-feature.ts`
- [x] Write E2E test suite in `tests/broadcast_engine_e2e.test.ts`
- [x] Verify 17/17 tests passing across all suites and 0 TypeScript compilation errors

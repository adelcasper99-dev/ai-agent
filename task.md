# Smart Voice Reminder Engine — Task Checklist

## Phase 1: Database & Tool Declarations
- [x] Extend `prisma/schema.prisma` with `Reminder` model and tenant relations
- [x] Push schema migration to database (`npx prisma db push`)
- [x] Declare `set_reminder`, `get_reminders`, `cancel_reminder` tools in `lib/telegram_llm.ts`
- [x] Add tools to `ALL_TOOLS`, `APPOINTMENT_TOOLS`, `ALUMITAL_TOOLS`, and router cluster mapping

## Phase 2: Core Execution & Temporal Parsing
- [x] Implement Egyptian Arabic relative and absolute datetime parser (`parseEgyptianArabicDateTime`)
- [x] Add `set_reminder`, `get_reminders`, `cancel_reminder` handlers in `executeTool`
- [x] Add reminder tools to `FINANCIAL_TOOLS` tenant isolation guard
- [x] Implement single-line clean creation responses and interactive summary lists with action buttons

## Phase 3: Telegram Callbacks & Background Dispatcher
- [x] Add `done_rem_<id>`, `snooze_rem_<id>_<mins>`, `del_rem_<id>` callback handlers in `app/api/telegram/webhook/route.ts`
- [x] Create automated reminder polling & push dispatcher API in `app/api/cron/reminders/route.ts`
- [x] Enforce atomic status locking (`pending` -> `sending` -> `sent`) against concurrent dispatch duplicate alerts

## Phase 4: Verification & E2E Testing
- [x] Write E2E test suite in `tests/reminders_engine_e2e.test.ts`
- [x] Verify multi-tenant isolation, relative time parsing, customer linking, and cancellation
- [x] Run full test suite (14/14 passing tests) and `tsc --noEmit` check (0 errors)

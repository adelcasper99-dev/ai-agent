# Task Tracking — Stage 3 Surgical Build

- [x] Add `ConversationState` model to `schema.prisma`.
- [x] Refactor `telegram_llm.ts` to export structured `LLMResult`.
- [x] Create `telegram_fallback.ts` with Sales flow state machine.
- [x] Intercept Telegram callbacks and text input in `app/api/telegram/webhook/route.ts`.
- [x] Run `npx prisma db push` to synchronize local SQLite database.

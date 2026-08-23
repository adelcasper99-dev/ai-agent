# Task List — Alumital Estimator Remediation (Block B Build)

- [x] **Task 1**: Wire `calculate_alumital_quotation` to `casper-voice-web/lib/telegram_llm.ts` (tool declaration, ALL_TOOLS array, ALUMITAL cluster router, extraction rules).
- [x] **Task 2**: Add `calculate_alumital_quotation` dispatch handler to `executeTool` with Zod parsing, Decimal.js calculations, draft quote DB persistence, and interactive inline confirmation cards.
- [x] **Task 3**: Add `confirm_quote_*` and `cancel_quote_*` callback query handlers to `casper-voice-web/app/api/telegram/webhook/route.ts` with atomic DB status locks (`WHERE status = 'draft'`).
- [x] **Task 4**: Add `sendTelegramPhoto` and `sendTelegramDocument` helpers to `casper-voice-web/lib/telegram.ts`.
- [x] **Task 5**: Build full production `src/lib/alumital/media_worker.ts` & `casper-voice-web/lib/alumital/media_worker.ts` with SVG sketch generator, Sharp SVG-to-PNG binary conversion, Cairo Google Font Arabic HTML template, and Puppeteer singleton PDF rendering.
- [x] **Task 6**: Install `sharp` and `puppeteer-core` dependencies in `casper-voice-web/package.json`.
- [x] **Task 7**: Run comprehensive Vitest E2E test suite (`tests/alumital_telegram_e2e.test.ts` - 5/5 GREEN) and unit test suite (`tests/alumital_estimator.test.ts` - 4/4 GREEN).
- [x] **Task 8**: Validate zero TypeScript compilation errors with `npx tsc --noEmit`.

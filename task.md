# 📋 Stage 3 Build Tasks — Telegram Inline Keyboards & Numbered Choice Interceptor

- [x] 1. Implement `sendTelegramMessageWithKeyboard` and `answerTelegramCallbackQuery` helpers in `route.ts` / `telegram_llm.ts`.
- [x] 2. Format `C2 Ambiguity Guard`, `Confirmation Guard`, and `Buying vs Selling Guard` with numbered options `1.` / `2.` + Inline Keyboard `inline_keyboard` payload.
- [x] 3. Implement Single-Digit Interceptor (`1`, `2`, `١`, `٢`) and Invalid Choice Handler (`3`, invalid option) in `route.ts` / `telegram_llm.ts`.
- [x] 4. Implement 30-minute State Machine Expiration logic (`pendingChoiceExpiresAt`).
- [x] 5. Implement Telegram `callback_query` webhook payload handler in `app/api/telegram/webhook/route.ts`.
- [x] 6. Verify zero `any` type violations and complete TypeScript build (`npx tsc --noEmit`).

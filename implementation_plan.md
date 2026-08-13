# 🛠️ Hardened Implementation Plan — Telegram Interactive Inline Keyboards & Choice Interceptor
## Full-Stack Option Buttons, Single-Digit Interception (1, 2) & Callback Query Handler

---

## 📋 Summary & Objectives
Enhance Casper POS Telegram Agent with **Interactive Telegram Inline Keyboard Buttons** and **Single-Digit Text Shortcuts (`1`, `2`, `١`, `٢`)** for all clarification and confirmation prompts:

1. **Price Ambiguity (C2)**: Offer Inline Buttons (`[📦 إجمالي 1000 ج]`, `[💰 سعر القطعة 10,000 ج]`) or text choices (`1` / `2`).
2. **Cancellation Guard**: Offer Inline Buttons (`[✅ تأكيد الإلغاء]`, `[❌ إلغاء الطلب]`) or text choices (`1` / `2`).
3. **Purchase vs Sale Disambiguation**: Offer Inline Buttons (`[🛒 مشتريات]`, `[🛍️ مبيعات]`) or text choices (`1` / `2`).
4. **State Machine Expiry & Invalid Choice Protection**:
   - Auto-expire pending choices after 30 minutes.
   - Reply with clear error if an invalid digit (e.g. `3`) or unrecognized option is typed.

---

## 🛠️ Proposed Changes

### Component 1: Telegram Webhook Route Callback Query Support
#### [MODIFY] [route.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/app/api/telegram/webhook/route.ts)
- Add handler for `callback_query` payload in Telegram webhook request.
- Extract `callback_query_id`, `data`, and `chat_id`.
- Automatically invoke Telegram `answerCallbackQuery` API to stop loading spinner.
- Resolve choice and edit original telegram message text to show final resolution.

### Component 2: Choice Formatting & Inline Keyboard Helper
#### [MODIFY] [telegram_llm.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/lib/telegram_llm.ts)
- Update `groundingCheck` and `cancel_last_transaction` to return structured choice metadata:
  - `replyMarkup`: Telegram `inline_keyboard` payload with callback data.
  - Numbered text choices (1., 2.) in message body.
- Implement single-digit interceptor (`1`, `2`, `١`, `٢`) in `executeTool` / webhook router.

### Component 3: Database & State Machine Expiration
#### [MODIFY] [telegram_llm.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/lib/telegram_llm.ts)
- Persist pending state in `ConversationState` table with `expiresAt = Date.now() + 30 * 60 * 1000`.
- Purge expired states before processing new choices.

---

## 🧪 Verification Plan

### Automated Unit & Integration Tests
- Run `npx tsx test_telegram_keyboards.ts` verifying:
  1. Callback Query payload resolution.
  2. Single-digit interceptor (`1`, `2`, `١`, `٢`).
  3. Expiration handling (> 30 mins).
  4. Invalid option handling (`3`).
  5. Zero TypeScript errors (`npx tsc --noEmit`).

### Manual Verification
- Testing directly on Telegram bot with live inline buttons and digit replies.

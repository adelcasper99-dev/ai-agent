# 📚 Stage 0b: Best-Practice Research — Telegram Inline Keyboards & Callback Handlers

## 1. Telegram Bot API Best Practices for Inline Keyboards
- **Callback Data Encoding (`callback_data`)**: Must be <= 64 bytes total. Structure using compact colon-delimited schema:
  `c:<action>:<id_or_val>` (e.g. `c:price:tot:1000` or `c:cancel:conf:p123`).
- **Answer Callback Query (`answerCallbackQuery`)**: EVERY callback query MUST be answered immediately via Telegram API (`answerCallbackQuery(callback_query_id)`) to remove the loading spinner on the user's client button.
- **Message Editing (`editMessageText` or `editMessageReplyMarkup`)**: Once a button is clicked, update the original message to remove the buttons and show the resolved state (e.g. `✅ تم تأكيد إجمالي الفاتورة: 1000 ج`), preventing double-clicking on stale buttons.

## 2. State Interceptor Architecture (SQLite / Prisma `ConversationState`)
- Store active choice context in `ConversationState`:
  - `pendingType`: `'PRICE_AMBIGUITY' | 'CONFIRM_CANCEL' | 'BUY_VS_SELL'`
  - `pendingData`: JSON string containing args, toolName, and original message
  - `expiresAt`: `now() + 30 minutes`
- Single-Digit Interception (`1`, `2`, `١`, `٢`):
  - Intercept in webhook handler before sending to LLM.
  - Map `1` / `١` -> Choice A, `2` / `٢` -> Choice B.
  - If state is expired or invalid option -> prompt clear error and reset state.

## 3. High-Security Transaction Guards (RBAC & Financial Precision)
- Double-entry accounting rules apply to resolved purchases/sales.
- Monetary fields parsed from callback or text must strictly use `Decimal.js`.

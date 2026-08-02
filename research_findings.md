# Research Findings: Telegram Inline Keyboard State Machine & Fallback Flow

## Executive Summary
This document summarizes best practices for building an offline/no-AI fallback state machine using Telegram Inline Keyboards and Next.js / Prisma.

---

## 1. Telegram Inline Keyboard State Machine Patterns
- **Message Editing vs New Messages**: To maintain clean chat histories, use `editMessageText` and `editMessageReplyMarkup` for step updates instead of broadcasting new messages wherever possible.
- **Callback Data Convention**: Use structured callback strings like `flow:step:action` or `menu:sale`, `sale:payment:cash`. Keep length under 64 bytes (Telegram API limit for `callback_data`).
- **Answer Callback Query**: Always call `answerCallbackQuery` immediately to dismiss the loading animation on button clicks.

---

## 2. Multi-Tenant Conversation State Management
- **Database Model**: Storing state in SQLite/PostgreSQL with `telegramChatId` as `@unique` guarantees single-session isolation per chat.
- **JSON Payload for Transient Inputs**: Storing step responses in a JSON field (`collectedData`) enables flexible multi-step data collection without adding rigid schema columns for every intermediate state.
- **State Timeout & Cleanup**: Include an expiration mechanism (`updatedAt` check or cron) so abandoned state machines auto-reset after 60 minutes.

---

## 3. Double-Entry Accounting & Ledger Integrity
- **Idempotency & Precision**: Use `Decimal.js` for financial computations. When creating a `Sale`, automatically create matching `CustomerLedgerEntry` (if customer present) and `JournalEntry` (Debits: Cash/Receivables, Credit: Sales Revenue).

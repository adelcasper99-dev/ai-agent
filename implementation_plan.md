# Telegram Fallback Flow (No-AI) Implementation Plan

## Overview
Implement an offline, menu-driven state machine for Telegram that automatically activates when all AI providers (Gemini, Groq, OpenAI, OpenRouter) fail or exhaust quota. The initial MVP focuses on the 5-step Sales flow with confirmation.

---

## User Review Required
> [!WARNING]
> Database migration required: Adds `ConversationState` table to Prisma schema. `npx prisma db push` will be executed locally and on the HQ VPS server.

---

## Proposed Changes

### 1. Database Schema
#### [MODIFY] [schema.prisma](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/prisma/schema.prisma)
- Add `ConversationState` model linked to `Tenant`:
```prisma
model ConversationState {
  id             String   @id @default(cuid())
  tenantId       String
  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  telegramChatId String   @unique
  currentFlow    String?  // "sale" | "purchase" | null
  currentStep    String?  // "customer" | "item" | "quantity" | "total_price" | "payment_method" | "confirm"
  collectedData  String   @default("{}") // JSON object containing collected step values
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([tenantId])
}
```
- Add relation `conversationStates ConversationState[]` to `Tenant`.

---

### 2. Structured LLM Result Type
#### [MODIFY] [telegram_llm.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/lib/telegram_llm.ts)
- Update `processTelegramMessageWithLLM` signature to return a type-safe discriminator:
```ts
export type LLMResult =
  | { status: "success"; text: string }
  | { status: "all_providers_exhausted"; lastError?: string };
```

---

### 3. Telegram Fallback Core State Machine
#### [NEW] [telegram_fallback.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/lib/telegram_fallback.ts)
- Implement state machine helpers:
  - `sendFallbackMainMenu(chatId, messageId?)`: Renders inline keyboard (`💰 مبيعات`, `📦 مشتريات`, etc.).
  - `handleFallbackMenuCallback(...)`: Handles `menu:sale` click -> sets state `currentFlow: "sale", currentStep: "customer"`.
  - `processFallbackInput(chatId, tenantId, text, state)`: Validates step inputs (customer, item, quantity, total_price) and transitions steps.
  - `handleFallbackSaleCallback(...)`: Handles `sale:cash_customer`, `sale:pay:*`, `sale:confirm:*`.
  - `executeSaleFlow(...)`: Creates DB Sale record, CustomerLedgerEntry, and JournalEntries within a Prisma transaction.
  - `resetFallbackState(chatId)`: Clears current flow.

---

### 4. Telegram Webhook Handler Integration
#### [MODIFY] [route.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/app/api/telegram/webhook/route.ts)
- Intercept incoming text messages: if active `ConversationState` exists with `currentFlow`, pass text to `processFallbackInput`.
- Intercept incoming callbacks: route `menu:*` and `sale:*` callbacks to fallback handlers.
- Failover trigger: If `processTelegramMessageWithLLM` returns `status: "all_providers_exhausted"`, set `conversation.mode = "fallback_menu"`, call `sendFallbackMainMenu`, and notify admin.

---

## Verification Plan

### Automated Tests
- Run `npm run build` to verify strict TypeScript types.
- Check Prisma schema validity with `npx prisma validate`.

### Manual Verification
- Simulate AI provider failure and verify automatic main menu trigger on Telegram.
- Execute complete Sales Flow step-by-step: Customer -> Item -> Quantity -> Total Price -> Payment Method -> Confirm.
- Verify DB records created: `Sale`, `CustomerLedgerEntry`, `JournalEntry`.

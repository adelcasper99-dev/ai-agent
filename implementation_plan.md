# Chat History Buffer — Multi-Turn LLM Context Implementation Plan

## Overview
Implement a rolling 6-message Chat History Buffer per chat session (`tenantId` + `telegramChatId`) so that pronouns ("هو", "الباقي", "زي اللي قبل كده") and multi-turn context are preserved across Telegram text interactions.

---

## User Review Required
> [!WARNING]
> Database migration required: Adds `ChatMessage` model to Prisma schema. `npx prisma db push` will be executed locally and on HQ VPS.

---

## Proposed Changes

### 1. Database Schema
#### [MODIFY] [schema.prisma](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/prisma/schema.prisma)
- Add `ChatMessage` model:
```prisma
model ChatMessage {
  id             String   @id @default(cuid())
  tenantId       String
  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  telegramChatId String
  role           String   // "user" | "assistant"
  text           String
  createdAt      DateTime @default(now())

  @@index([tenantId, telegramChatId])
  @@index([createdAt])
}
```
- Add `chatMessages ChatMessage[]` relation to `Tenant`.

---

### 2. Multi-Turn LLM Engine Integration
#### [MODIFY] [telegram_llm.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/lib/telegram_llm.ts)
- Pass `telegramChatId` to `processTelegramMessageWithLLM`.
- Query `ChatMessage` table for the last 6 messages within the last 60 minutes for `(tenantId, telegramChatId)`.
- Format history:
  - For **Gemini**: Map to `{ role: "user" | "model", parts: [{ text: "..." }] }` and pass to `model.startChat({ history })`.
  - For **Groq**: Map to `{ role: "user" | "assistant", content: "..." }` and pass to `groq.chat.completions.create({ messages })`.
- Save incoming user message and outgoing bot response to `ChatMessage` table after execution.

---

### 3. Webhook Handler
#### [MODIFY] [route.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/app/api/telegram/webhook/route.ts)
- Pass `chatId` to `processTelegramMessageWithLLM(text, tenant?.id, tenant?.name, tenant?.businessType, tenant?.workingHours, chatId)`.

---

## Verification Plan

### Automated Tests
- Run `npm run build` to verify TypeScript compilation.

### Manual Verification
1. Send message: `بيع 2 كرتونة مسامير لـ أحمد محمد`
2. Send follow-up: `هو عليه كام كده؟`
3. Verify the LLM understands "هو" refers to "أحمد محمد" and calls `get_customer_balance` for "أحمد محمد".

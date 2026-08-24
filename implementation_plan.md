# Implementation Plan: Smart Voice Reminder & Telegram Scheduled Alerts Engine

## 1. Executive Summary
Enable merchants and workshop owners to set natural voice/text reminders via Telegram bot (e.g. `"فكرني بكرة الساعة 5 بتسليم شباك محمد صادق"`). The system extracts the reminder parameters, stores them with strict tenant isolation, executes background checks, and sends push notifications to Telegram with action buttons `[✅ تم الإنجاز]` and `[⏰ تأجيل ساعة]`.

---

## 2. Proposed Architectural Changes

### A. Database Schema (`prisma/schema.prisma`)
Add `Reminder` model:
```prisma
model Reminder {
  id             String    @id @default(cuid())
  tenantId       String
  tenant         Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customerId     String?
  customer       Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  customerName   String?
  title          String
  remindAt       DateTime
  status         String    @default("pending") // pending | sent | completed | cancelled
  telegramChatId String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([tenantId, status, remindAt])
  @@index([status, remindAt])
}
```
Add relation `reminders Reminder[]` to `Tenant` and `Customer`.

---

### B. AI Tools in Telegram LLM Engine (`lib/telegram_llm.ts`)
1. `setReminderTool`:
   - Name: `set_reminder`
   - Parameters: `title`, `remind_at_iso`, `customer_name`
   - Description: تسجيل تذكير بميعاد تسليم أو متابعة أو مهمة
2. `getRemindersTool`:
   - Name: `get_reminders`
   - Parameters: `customer_name?`
   - Description: عرض قائمة التذكيرات القادمة والمستحقة
3. `cancelReminderTool`:
   - Name: `cancel_reminder`
   - Parameters: `reminder_id?`, `title_keyword?`
   - Description: إلغاء أو حذف تذكير محدد

---

### C. Telegram Webhook Callback Queries (`app/api/telegram/webhook/route.ts`)
- `done_rem_<id>`: Marks reminder status as `completed`.
- `snooze_rem_<id>_<mins>`: Postpones `remindAt` by N minutes and resets status to `pending`.
- `del_rem_<id>`: Cancels the reminder.

---

### D. Automated Dispatcher API & Worker (`app/api/cron/reminders/route.ts`)
- Scans `status: "pending"` and `remindAt <= new Date()`.
- Sends `sendTelegramAlert` with interactive inline keyboard.
- Idempotently updates status to `sent`.

---

## 3. Verification Plan
- Unit & E2E Vitest suite testing `set_reminder`, `get_reminders`, `cancel_reminder`, temporal parsing, and multi-tenant isolation.
- TypeScript zero-error type check (`npx tsc --noEmit`).

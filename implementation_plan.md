# Implementation Plan: Casper Telegram Caveman Mode & Customer Technical Measurements Engine

## 1. Context & Architecture Overview
Casper POS & ERP utilizes Next.js 16, React 19, SQLite / PostgreSQL with Prisma, and Gemini Flash LLM orchestration for voice and Telegram bot assistants.
This plan addresses:
1. **System Prompt Hardening:** Injecting strict Caveman brevity and token conservation into `buildActivePrompt` in `casper-voice-web/lib/telegram_llm.ts`.
2. **Customer Measurement Engine:** Adding `CustomerMeasurement` model in Prisma, implementing `save_customer_measurement` and `get_customer_measurements` tools, registering them in tool definitions, router clusters, and intent handlers.
3. **Quotation & Measurement Harmonization:** Ensuring zero collision between financial estimations (`Quotation`) and technical dimensions (`CustomerMeasurement`).

---

## 2. Proposed Code & Schema Modifications

### A. Database Schema (`casper-voice-web/prisma/schema.prisma`)
- Add `CustomerMeasurement` model:
```prisma
model CustomerMeasurement {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customerId   String?
  customer     Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  customerName String
  itemType     String   @default("شباك")
  width_cm     Decimal?
  height_cm    Decimal?
  quantity     Int      @default(1)
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([tenantId, customerName])
  @@index([tenantId, createdAt])
}
```
- Update `Tenant` and `Customer` models with relation fields.

### B. System Prompt & Tool Routing (`casper-voice-web/lib/telegram_llm.ts`)
- **Caveman System Prompt Rule:**
  - "الردود فائقة الإيجاز (سطر أو سطرين فقط) بالعامية المصرية الصريحة السريعة."
  - "ممنوع نهائياً الاعتذارات، مقدمات الترحيب الزائدة، أو شرح آليات وبرمجة السيستم الداخلية."
  - "إذا لم تتوفر بيانات أو ميزة، أجب في جملة واحدة مباشرة ومفيدة."
- **Tool Declarations:**
  - `saveCustomerMeasurementTool`: saves dimensions, item type, quantity, customer name, notes.
  - `getCustomerMeasurementsTool`: queries and returns recorded measurements for customer.
- **Cluster Keywords:**
  - Add `MEASUREMENTS` / update `ALUMITAL` keywords with `مقاس`, `مقاسات`, `أبعاد`, `رفع مقاس`, `مقاس شباك`, `مقاس باب`.
- **Tool Handlers:**
  - Execute database transaction to record `CustomerMeasurement`.
  - Format concise response for retrieved dimensions.

---

## 3. Verification & Testing Plan
- Create Vitest test suite `casper-voice-web/tests/customer_measurements_e2e.test.ts`:
  1. Test tool routing resolves `save_customer_measurement` on "سجل مقاس لمحمد صادق شباك 120 في 140".
  2. Test tool routing resolves `get_customer_measurements` on "مقاسات العميل محمد صادق".
  3. Test zero collision between `calculate_alumital_quotation` and `save_customer_measurement`.
  4. Test database persistence and retrieval of `CustomerMeasurement`.
  5. Test Caveman response length (< 120 characters, zero apologetic keywords).
- Run full test suite: `npx vitest run`.

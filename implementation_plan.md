# Implementation Plan: Feature Broadcast & Release Notes Engine

## 1. Executive Summary
Build an end-to-end Feature Broadcast and Release Notes Engine enabling Super Admins to announce new functions with live interactive examples to all active merchants via Telegram and Admin Dashboard.

---

## 2. Proposed Database Changes

### `casper-voice-web/prisma/schema.prisma`
- Add `FeatureRelease` model:
```prisma
model FeatureRelease {
  id          String   @id @default(cuid())
  title       String
  description String
  examples    String   // JSON string of [{ label: string, prompt: string }]
  targetType  String   @default("all") // "all" | "business_type" | "selected"
  status      String   @default("draft") // "draft" | "sending" | "completed" | "failed"
  sentCount   Int      @default(0)
  failedCount Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([status, createdAt])
}
```

---

## 3. Backend & API Services

### 3.1 Broadcast API: `casper-voice-web/app/api/admin/broadcast/route.ts`
- **POST `/api/admin/broadcast`**:
  - Validates payload with Zod schema (`title`, `description`, `examples`, `targetType`, `previewOnly`).
  - If `previewOnly: true`: Sends test card only to `ADMIN_CHAT_ID`.
  - If `previewOnly: false`:
    - Queries active tenants (`state: "active"`, `telegramChatId != null`).
    - Dispatches in throttled batches (20 concurrent with 50ms delay).
    - Logs success/failure counts in `FeatureRelease` record.

### 3.2 Webhook Interactive Try-It Handler: `casper-voice-web/app/api/telegram/webhook/route.ts`
- Handle callback query `try_f_<releaseId>_<exIdx>`:
  - Fetch release record from DB.
  - Parse `examples` JSON and retrieve prompt at `exIdx`.
  - Send feedback banner: `"🧪 جاري تجربة المثال: \"${prompt}\"..."`.
  - Call `processTelegramMessageWithLLM(prompt, tenant.id, ...)` to execute the tool/intent live for the merchant.

### 3.3 CLI Broadcast Script: `casper-voice-web/scripts/broadcast-feature.ts`
- Standalone command-line utility for instant terminal announcements.

---

## 4. Verification Plan
- **Automated Tests:** `tests/broadcast_engine_e2e.test.ts` (Zod validation, rate-limited batching, interactive callback execution).
- **TypeScript Check:** `npx tsc --noEmit` passing with 0 errors.
- **Simulation Test:** Test preview broadcast to admin chat and simulate merchant 1-click try callback.

# Feature Broadcast & Release Notes Engine — Requirements & Brainstorming

## 1. Objective & User Story
Enable Super Admins and the Casper Engineering team to broadcast interactive feature releases and release notes directly to active merchants via Telegram and the Admin Dashboard. Every broadcast contains clear colloquial Arabic explanations, live usage examples (text & voice prompts), and 1-click interactive quick-try buttons.

---

## 2. Functional Requirements

### 2.1 Broadcast Creation & Management
- **FR-1:** Admin can compose a release announcement with:
  - Title & Emoji banner.
  - Short value summary (1-2 sentences in Egyptian Arabic).
  - List of up to 3 interactive examples (text prompt, description, target tool).
  - Target audience filter (`all_active`, `by_business_type`, `specific_tenants`).
- **FR-2:** Preview Mode: Admin can send a draft test broadcast to their own Telegram chat (`ADMIN_CHAT_ID`) before public dispatch.
- **FR-3:** Release History: Store past feature announcements in `FeatureRelease` model in DB.

### 2.2 Telegram Card Delivery & Rate-Limiting
- **FR-4:** High-throughput batching: Dispatch messages with 30-50ms spacing to respect Telegram's 30 msg/sec limit.
- **FR-5:** Error Handling: Catch blocked bots or deactivated chats without failing the entire batch; update recipient delivery status.

### 2.3 Interactive Quick-Try Flow (1-Click Test)
- **FR-6:** Every broadcast card includes inline action buttons:
  - `[🧪 جرب: "فكرني بكرة 5"]` -> Callback `try_feat_<releaseId>_<exampleIndex>`
  - `[📖 دليل الميزة]` -> Callback `info_feat_<releaseId>`
- **FR-7:** When a merchant taps the quick-try button:
  - Webhook intercepts callback and passes the example prompt to `processTelegramMessageWithLLM`.
  - Sends immediate simulated bot response directly to the merchant.

---

## 3. Non-Functional Requirements
- **NFR-1 (Multi-Tenant Isolation):** Only merchants with active subscriptions receive broadcasts.
- **NFR-2 (Latency):** Broadcast queue processed asynchronously (0ms blocking on Admin UI).
- **NFR-3 (Type Safety):** Zod schemas for broadcast payloads and strict TypeScript with 0 `any` types.

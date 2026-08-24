# Research Findings: High-Reliability Telegram Broadcasts & Interactive Try-It Flows

## 1. Telegram Bot API Rate-Limiting & Flood Control
- **Official Constraints:** Maximum 30 messages/second globally from a single bot token, and max 1 message/second per private chat.
- **Best Practice:**
  - Sequential batching with `Promise.all` over chunks of 20 with `await sleep(50)` between batches.
  - Exponential backoff on `HTTP 429` parsing `retry_after` response header.
  - Immediate logging of `403 Forbidden: bot was blocked by the user` to mark merchant chat as inactive.

## 2. Interactive Quick-Try Callbacks Architecture
- **Telegram Limit:** Callback data payload size limit is 64 bytes.
- **Pattern:**
  - Use compact callback keys: `try_f_<shortId>_<exIdx>`.
  - Store full example text in the database (`FeatureRelease.examples`), retrieve by index on callback tap.
  - Trigger `processTelegramMessageWithLLM(exampleText, tenantId, ...)` and deliver instant response.

## 3. Schema & Data Model Design
- `FeatureRelease` model:
  - `id`: UUID
  - `title`: String
  - `description`: String (Markdown supported)
  - `examples`: Json (Array of `{ label: string, prompt: string }`)
  - `targetType`: String ("all", "business_type", "selected")
  - `status`: String ("draft", "sending", "completed", "failed")
  - `sentCount`: Int (default 0)
  - `failedCount`: Int (default 0)
  - `createdAt`: DateTime (default now)

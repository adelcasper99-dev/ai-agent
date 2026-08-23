# 🔬 Best Practices Research: Casper Alumital Estimator

## Technical Stack & Architectural Patterns

### 1. Financial Precision & Decimal Engine
- **Pattern**: Enforce `Decimal.js` across all monetary, area, dimension, and percentage calculations.
- **Rule**: Float math (`+`, `-`, `*`, `/`) is strictly prohibited on monetary fields.
- **Precision Rules**:
  - Dimensions (`width_cm`, `height_cm`): converted to meters via `new Decimal(cm).div(100)`.
  - Area (`area_sqm`): `width_m.times(height_m)`, enforced minimum area threshold `if (area < 1) area = 1`.
  - Pricing: `window_total = area * price_per_meter * quantity`.
  - Extra items: array of line totals `new Decimal(unit_price).times(quantity)`.
  - Final total: `subtotal - discount`. Stored with `@db.Decimal(12, 2)`.

### 2. State Machine & Idempotency
- **Pattern**: Strict transition state machine for `Quotation`: `draft` -> `processing_media` -> `confirmed` / `media_failed` -> `sent` / `cancelled`.
- **Concurrency Protection**: Perform atomic state updates (`UPDATE "Quotation" SET status = 'processing_media' WHERE id = quote_id AND status = 'draft'`).
- **Idempotency**: If zero rows modified, reject duplicate call without error.

### 3. Telegram Bot LLM Integration & RBAC
- **Pattern**: System prompt guardrails + explicit code middleware in `telegram_llm.ts`.
- **Security Check**: Gated `price_per_meter`, discounts, and `extra_items` manipulation to verified `ADMIN_CHAT_ID`.

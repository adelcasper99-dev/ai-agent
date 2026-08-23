# 📐 Implementation Plan: Casper Alumital Estimator

## 1. Executive Summary
Add a sub-agent tool module (`calculate_quotation`, `confirm_quotation`, `generate_media`) to Casper AI Agent (Telegram) for window/kitchen aluminum estimation.

## 2. Component Blueprint

### A. Prisma Schema (`prisma/schema.prisma`)
Add `Quotation` model:
- `id`: UUID Primary Key
- `tenantId`: String
- `customerRef`: String?
- `width_cm`, `height_cm`: Decimal
- `quantity`: Int
- `price_per_meter`: Decimal
- `area_sqm`: Decimal
- `window_total`: Decimal
- `extra_items`: Json? (`[{ name, unit_price, quantity, line_total }]`)
- `discount_pct`, `discount_amount`: Decimal?
- `total_price`: Decimal
- `status`: String (`draft` | `processing_media` | `confirmed` | `media_failed` | `sent` | `cancelled`)
- `pdfUrl`, `sketchUrl`: String?
- `createdAt`: DateTime @default(now())
- `@@index([tenantId, status])`

### B. Estimation Engine & Zod Schemas (`src/lib/alumital/estimator.ts`)
- Strict Zod validation schemas.
- Pure `Decimal.js` pricing function (`calculateQuotation`).

### C. Telegram Tool Registrations (`src/lib/telegram/telegram_llm.ts`)
- Register `calculate_quotation`, `confirm_quotation`, `generate_media`.
- RBAC middleware (`ADMIN_CHAT_ID` check).

### D. Media Workers (`src/lib/alumital/media_worker.ts`)
- PDF Invoice renderer (`@react-pdf/renderer`).
- PNG Scale sketch renderer (`sharp` + SVG template).
- Background queue with retry logic (3 attempts).

## 3. Verification & Safety Criteria
- Unit tests with Vitest (`tests/alumital_estimator.test.ts`).
- Zero float math checks.
- TypeScript strict typing (zero `any`).

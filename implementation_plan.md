# Implementation Plan — Complete Launch Readiness Fixes
> Generated: 2026-08-11 | Casper Voice & ERP Pipeline

---

## Executive Summary

This plan addresses all 39 findings from the full launch readiness audit across 4 prioritized waves:
- **Wave 0 (Critical)**: Fix JWT fallback PM2 bypass, cross-tenant appointment leak, and login rate limiting.
- **Wave 1 (Infrastructure)**: Complete PM2 environment keys, Python worker restart delay, Nginx security headers & rate limits, SQLite WAL mode, and requirements exact-pinning.
- **Wave 2 (Database Schema)**: Add `tenantId` to `TokenUsage` and `Conversation`, migrate monetary fields from `Float` to `Decimal`, and create `CsatRating` model.
- **Wave 3 (Features & Quality)**: Token usage alerts, subscription expiry enforcement, CSAT persistence, test file renaming, and documentation cleanup.

---

## User Review Required

> [!IMPORTANT]
> - **PM2 Configuration**: `ecosystem.config.js` will require `JWT_SECRET` to be set in environment prior to starting PM2. Missing secrets will cause startup to fail closed.
> - **Database Migration**: Wave 2 includes migrating monetary fields from `Float` to `Decimal`. Run `npx prisma migrate deploy` on production after deploying code changes.

---

## Proposed Changes

### Component 1: Security & Auth

#### [MODIFY] [ecosystem.config.js](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/ecosystem.config.js)
- Remove `'casper-default-jwt-secret-key-2026'` fallback from `JWT_SECRET`.
- Add `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `DEEPGRAM_API_KEY`, `FISH_API_KEY`, `FISH_VOICE_ID`, `DATABASE_URL` to `casper-voice-web` env block.
- Add `max_restarts: 10`, `restart_delay: 3000`, `min_uptime: '10s'` to `casper-livekit-worker` block.

#### [MODIFY] [casper-voice-web/app/api/telegram/webhook/route.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/app/api/telegram/webhook/route.ts)
- Filter `cmd_appointments` query by tenant (`where: { tenantId: tenant.id }`).
- Persist CSAT ratings to database when `csat:` callback is received.

#### [MODIFY] [casper-voice-web/app/api/auth/login/route.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/app/api/auth/login/route.ts)
- Add IP-based sliding window rate limiting (5 attempts / 15 min).

---

### Component 2: Infrastructure & Database

#### [MODIFY] [nginx.conf](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/nginx.conf)
- Add `limit_req_zone` for webhooks (5r/s), tokens (2r/s), and login (3r/m).
- Add HTTP security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- Set `client_max_body_size 20m` and `proxy_read_timeout 60s`.

#### [MODIFY] [casper-voice-web/lib/prisma.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/lib/prisma.ts)
- Execute SQLite WAL mode PRAGMAs (`journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000`) on initialization.

#### [MODIFY] [casper-voice-web/prisma/schema.prisma](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/prisma/schema.prisma)
- Add `tenantId` field & index to `TokenUsage` and `Conversation`.
- Update monetary fields (`Expense.amount`, `Sale.price/total/paidAmount/deferredAmount`, `Product.unitPrice`, `Purchase.totalAmount/paidAmount/deferredAmount`, `SupplierPayment.amount`, `CustomerLedgerEntry.amount`, `JournalEntry.debit/credit`) from `Float` to `Decimal`.
- Add `CsatRating` model.
- Fix garbled UTF-8 header comment at line 337.

---

### Component 3: Features & Quality

#### [NEW] [casper-voice-web/lib/usage-alert.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/lib/usage-alert.ts)
- Check daily tenant token totals against 50,000 threshold and send Telegram alert to admin.

#### [NEW] [casper-voice-web/lib/subscription-guard.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/lib/subscription-guard.ts)
- Check tenant `expiresAt` timestamps and transition expired tenants to `past_due_silent`.

#### [MODIFY] [casper-voice-web/README.md](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/README.md)
- Replace `npx prisma db push` with `npx prisma migrate deploy`.

#### [MODIFY] [casper-voice-web/.env.example](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/.env.example)
- Add `OPENROUTER_API_KEY`.

---

## Verification Plan

### Automated Tests
- Run full test suite: `npm test` (includes all 15 test files).
- Rename `multi_tenant_verification_suite.ts` → `.test.ts` so Vitest executes it.
- Run type check & build: `npx prisma generate && npm run build`.

### Manual Verification
- Test rate limit on `/api/auth/login` with 6 consecutive bad passwords -> expect HTTP 429 on 6th request.
- Test `/cmd_appointments` in Telegram bot -> verify only current tenant's appointments are displayed.
- Test `health/voice` route -> verify database and LiveKit status reported.

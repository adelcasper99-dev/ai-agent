# Research Findings — Launch Readiness Fixes & Security Hardening
> Date: 2026-08-11 | Context: Casper POS & Voice ERP

---

## 1. Environment & PM2 Secret Management

### Best Practice
- Secrets in `ecosystem.config.js` should reference `process.env.VAR` directly without hardcoded fallback strings.
- Fallback strings in PM2 configurations defeat fail-closed runtime checks (like `if (!secret) throw new Error(...)`).
- All external API keys required by Next.js API routes must be explicitly passed in the PM2 process environment object.

### Implementation Checklist
- Strip `'casper-default-jwt-secret-key-2026'` fallback from `ecosystem.config.js`.
- Add `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `DEEPGRAM_API_KEY`, `FISH_API_KEY`, `FISH_VOICE_ID`, `DATABASE_URL` to `casper-voice-web` process config.
- Add `max_restarts: 10`, `restart_delay: 3000`, `min_uptime: '10s'` to python `casper-livekit-worker` process.

---

## 2. Multi-Tenant Data Isolation & API Security

### Best Practice
- Every database query in a multi-tenant application MUST filter by `tenantId`.
- Unfiltered queries (e.g. `prisma.appointment.findMany({ take: 10 })`) create cross-tenant data leaks.
- Authentication endpoints (like `/api/auth/login`) MUST be rate-limited at both the application level (`lib/rate-limit.ts`) and the web server level (`nginx.conf`).

### Implementation Checklist
- Scope `/cmd_appointments` in `webhook/route.ts` to `where: { tenantId: tenant.id }`.
- Add sliding window IP rate limiting (5 attempts / 15 min) to `/api/auth/login`.

---

## 3. Nginx Reverse Proxy Security & Rate Limiting

### Best Practice
- Nginx should enforce rate limiting using `limit_req_zone` for webhooks, token endpoints, and auth routes.
- Security headers (`HSTS`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) should be active on HTTPS servers.
- Upload limits (`client_max_body_size 20m`) and proxy read timeouts (`proxy_read_timeout 60s`) prevent HTTP 413/504 errors during audio processing.

---

## 4. SQLite Concurrency & Database Precision

### Best Practice
- Enable WAL mode (`PRAGMA journal_mode=WAL;`) on SQLite databases with concurrent write traffic (e.g. Telegram webhooks).
- Financial fields MUST NOT use double-precision floating-point types (`Float`) due to IEEE 754 rounding errors.
- Schema fields representing currency MUST use `Decimal` or `TEXT` (Prisma SQLite Decimal).

---

## 5. Python Dependency Pinning

### Best Practice
- Range-pinned dependencies (e.g. `>=1.6.7,<2.0.0`) in fast-evolving SDKs like `livekit-agents` risk breaking builds when sub-dependencies update.
- Always exact-pin production `requirements.txt` via `pip freeze`.

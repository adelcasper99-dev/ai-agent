# Task Tracker — Block B Implementation

- [x] Fix W0-1: `ecosystem.config.js` - remove hardcoded JWT secret fallback
- [x] Fix W0-2: `app/api/telegram/webhook/route.ts` - scope `cmd_appointments` and `/appointments` to tenantId
- [x] Fix W0-3: `app/api/auth/login/route.ts` - add sliding window rate limiting
- [x] Fix W1-1: `ecosystem.config.js` - add missing AI keys and python worker restart parameters
- [x] Fix W1-2: `nginx.conf` - add rate limit zones, security headers, proxy timeouts, body limits
- [x] Fix W1-3: `casper-voice-web/lib/prisma.ts` - enable SQLite WAL mode PRAGMAs
- [x] Fix W2-1 to W2-4: `casper-voice-web/prisma/schema.prisma` - add `tenantId` to `TokenUsage` & `Conversation`, `CsatRating` model, fix garbled comment
- [x] Fix W3-1 & W3-4: `casper-voice-web/lib/telegram_llm.ts` & `webhook/route.ts` - wire `tokenUsage` creation & CSAT persistence
- [x] Fix W3-2 & W3-3: create `casper-voice-web/lib/usage-alert.ts` & `casper-voice-web/lib/subscription-guard.ts`
- [x] Fix W3-6 to W3-8: rename `multi_tenant_verification_suite.ts` to `.test.ts`, update `.env.example` & `README.md`

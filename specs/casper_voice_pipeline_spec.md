# 📐 Spec-Kit Feature Specification: Casper Enterprise Voice Pipeline

**Feature Name:** Hybrid Real-Time Enterprise Voice Architecture & Smart Record Updates (PUT CRUD, Disambiguation, Decimal.js, Idempotency)  
**Spec Version:** 2.1.0  
**Last Updated:** 2026-07-30  

---

## 1. 🎯 Executive Business & Engineering Goals

1. **Human-Grade Voice Quality:** Provide zero-choppiness, 100% human-grade Egyptian Arabic voice interactions via Gemini Realtime Live API.
2. **Smart Update vs Create CRUD:** Allow voice-driven modifications of existing appointments, expenses, and supplier purchases without creating duplicate records.
3. **Disambiguation & Echo Confirmations:** Multi-candidate selection read-back when multiple records match, plus explicit old vs new amount echo confirmation for edits.
4. **Deterministic Financial Precision:** Strict integration of `Decimal.js` for expenses, sales, purchases, and supplier debt math with zero float arithmetic.
5. **Idempotency & Concurrency Safety:** `Idempotency-Key` 60s memory cache guard to prevent duplicate network retries, plus `updatedAt` optimistic concurrency checks (HTTP 409).
6. **Full Customer & Supplier Upserting:** Automatic linking of customer names and supplier balances in database persistence.

---

## 2. 🧱 Architectural Component Boundaries

```
[Client UI: VoiceCallModal / Dashboard]
    │  ▲
    │  │ WebRTC Audio + LiveKit DataChannel (ACTION_SUCCESS / TRANSCRIPT)
    ▼  │
[LiveKit Cloud Server]
    │  ▲
    │  │ WebSockets Stream
    ▼  │
[Voice Service: Python Agent (agent.py)]
    │ ──▶ [Gemini Realtime / Deepgram STT / Groq LLM / EdgeTTS]
    │ ──▶ [10 Function Tools: log_expense, log_sale, book_appointment, update_appointment, update_expense, pay_supplier_debt...]
    │
    ▼ REST API (Bearer Auth + Idempotency-Key Headers)
[Next.js API Routes: /api/appointments, /api/expenses, /api/purchases, /api/sales, /api/reports/*]
    │
    ▼ Prisma ORM (Decimal.js + updatedAt Optimistic Guards)
[SQLite (Desktop) / PostgreSQL (Cloud)]
```

---

## 3. 🛡️ Verification & Compliance Criteria

- [x] Zero Float Math on monetary values (`Decimal.js` enforced across Purchases, Sales, Expenses).
- [x] Smart Appointments Update (`PUT /api/appointments`) with Disambiguation candidate listing.
- [x] Smart Expenses Update (`PUT /api/expenses`) with Echo Confirmation (`oldAmount` & `newAmount`).
- [x] Supplier Debt Settlement (`PUT /api/purchases`) with `Idempotency-Key` 60s cache guard.
- [x] Optimistic Concurrency Protection (`updatedAt` check returning HTTP 409 Conflict).
- [x] Full Customer Name & Supplier Debt Upserting in Sales & Purchases routes.
- [x] Realtime DataChannel Event Broadcasting (`ACTION_SUCCESS`, `TRANSCRIPT`).
- [x] 19/19 Itemized Automated Unit Assertions PASSED (`tests/update_routes.test.ts`).
- [x] Next.js Production Build PASSED (Turbopack, 0 TS Errors).

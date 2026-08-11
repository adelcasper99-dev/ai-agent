# 📐 Spec-Kit Feature Specification: Casper Enterprise Voice Pipeline

**Feature Name:** Hybrid Real-Time Enterprise Voice Architecture & Smart Record Updates (PUT CRUD, Disambiguation, Decimal.js, Idempotency, Multi-Unit, Ambiguity Guards, Services, Personalized Onboarding)  
**Spec Version:** 2.5.0  
**Last Updated:** 2026-08-11  

---

## 1. 🎯 Executive Business & Engineering Goals

1. **Human-Grade Voice Quality:** Provide zero-choppiness, 100% human-grade Egyptian Arabic voice interactions via Gemini Realtime & Telegram LLM API rotation.
2. **Smart Update vs Create CRUD:** Allow voice-driven modifications of existing appointments, expenses, and supplier purchases without creating duplicate records.
3. **Disambiguation & Ambiguity Guards:** 
   - Customer Name Ambiguity: Prompts merchant when multiple customers match partial names (`AMBIGUOUS_CUSTOMER`).
   - Product Variant Ambiguity: Lists available sizes/variants when size is omitted (`AMBIGUOUS_PRODUCT`).
4. **Deterministic Financial Precision:** Strict integration of `Decimal.js` for expenses, sales, purchases, and supplier debt math with zero float arithmetic.
5. **Multi-Unit Conversion Engine:** Automatic unit conversions for fractional spoken sales (e.g. buy in meters, sell in centimeters: `50 سم = 0.5 م`).
6. **Stock vs Non-Stock Service Support:** Physical products (`isStockItem = true`) decrement stock, whereas services (`isStockItem = false`) log pure revenue without modifying physical stock levels.
7. **Personalized Merchant Greeting & Onboarding:** First-time onboarding prompts merchant for preferred name, persists it in `Tenant.merchantName`, and addresses merchant consistently as `"مستر <الاسم>"`.
8. **Arabic Day-Name Date Formatting:** Renders appointment dates into human-readable Egyptian dialect strings (e.g., `يوم الثلاثاء 11/8`).
9. **Idempotency & Concurrency Safety:** `Idempotency-Key` 60s memory cache guard to prevent duplicate network retries, plus `updatedAt` optimistic concurrency checks (HTTP 409).

---

## 2. 🧱 Architectural Component Boundaries

```
[Client UI: VoiceCallModal / Telegram Bot / Dashboard]
    │  ▲
    │  │ WebRTC Audio + LiveKit / Telegram Webhook Data Channel
    ▼  │
[Voice LLM Pipeline: telegram_llm.ts / Python Agent]
    │ ──▶ [Gemini 2.0/1.5 Flash / Groq LLM Rotation Pool]
    │ ──▶ [36 Scenario Integration Tools & Edge Case Handlers]
    │ ──▶ [Onboarding & Tenant Merchant Name Resolver]
    │
    ▼ REST API & Direct Service Layer (Bearer Auth + Idempotency-Key)
[Next.js API Routes: /api/appointments, /api/expenses, /api/purchases, /api/sales, /api/reports/*]
    │
    ▼ Prisma ORM (Decimal.js + SQLite WAL / PostgreSQL)
[Tenant Model (merchantName) / Product Model (isStockItem) / Customer / Supplier / Ledger]
```

---

## 3. 🛡️ Verification & Compliance Criteria

- [x] Zero Float Math on monetary values (`Decimal.js` enforced across Purchases, Sales, Expenses).
- [x] Multi-Unit Conversion Engine (`1m = 100cm`, buy in meters, sell in centimeters).
- [x] Customer Name Ambiguity Guardrail (`AMBIGUOUS_CUSTOMER` listing candidate names).
- [x] Product Variant Ambiguity Guardrail (`AMBIGUOUS_PRODUCT` listing catalog sizes/variants).
- [x] Stock Product vs Non-Stock Service Distinction (`isStockItem` flag enforcement).
- [x] Implicit Service Prompts (`"بيع تركيب وتأسيس بـ 500"` without needing explicit "خدمة" keyword).
- [x] Arabic Day-Name Date Formatting (`getArabicDayName`: e.g., `يوم الثلاثاء 11/8`).
- [x] Personalized Merchant Onboarding & Database Persistence (`Tenant.merchantName = "مستر محمود"`).
- [x] Optimistic Concurrency Protection (`updatedAt` check returning HTTP 409 Conflict).
- [x] Master 36-Scenario Integration Test Suite PASSED (`npx tsx test_all_tools.ts` — **36/36 PASSED 100%**).
- [x] Next.js Production Build PASSED (0 TS Errors).

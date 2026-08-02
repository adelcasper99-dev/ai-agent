# Task Tracking — Supplier Financial Module

- [x] Add `SupplierPayment` model to `schema.prisma`.
- [x] Run `npx prisma generate` and `npx prisma db push`.
- [x] Add `logSupplierPaymentTool` and `getSupplierBalanceTool` to `lib/telegram_llm.ts`.
- [x] Implement debt deduction & balance inquiry in `executeTool()`.
- [x] Register new tools in Gemini SDK & Groq SDK tools array.
- [x] Add Egyptian Arabic rules for supplier payments to `systemInstruction`.

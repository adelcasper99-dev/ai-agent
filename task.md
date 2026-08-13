# 📋 Task Log - Transaction Correction Tools (`cancel_last_transaction` & `correct_last_transaction`)

- [x] Prisma Schema Migration: Added `voided`, `voidedAt`, `voidedBy` fields to `Sale`, `Purchase`, and `Expense` models
- [x] Database Push: Synchronized SQLite database schema via `npx prisma db push`
- [x] Tool Declarations: Created `cancelLastTransactionTool` & `correctLastTransactionTool` in `lib/telegram_llm.ts`
- [x] Tool Cluster Registration: Added tools to `ALL_TOOLS`, `SALES_TOOLS`, `PURCHASE_TOOLS`, `FINANCE_META_TOOLS` & updated `CLUSTER_KEYWORDS`
- [x] Execute Handlers: Implemented `cancel_last_transaction` (atomic $transaction + confirmation guard) & `correct_last_transaction` (multi-field `corrections[]` + Decimal.js)

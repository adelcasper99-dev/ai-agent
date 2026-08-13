# 📚 Best-Practice Research: Transaction Cancellation & Soft-Void Patterns

## 1. Soft-Void vs Hard Delete in Accounting Systems
- **Problem**: Deleting transactional records (`Sale`, `Purchase`, `Expense`) breaks Foreign Key references in ledgers and ruins financial audit trails.
- **Pattern**: Enforce soft-voiding (`voided: Boolean @default(false)`, `voidedAt: DateTime?`, `voidedBy: String?`). Exclude `voided: true` records from standard GL calculations, balance sheets, and inventory counts.

## 2. Idempotency Guards in Financial Reversals
- **Problem**: Network retries or double-taps by users can execute cancellation tools twice, doubling inventory/ledger reversals.
- **Pattern**: Check `record.voided === true` at the very top of `cancel_last_transaction`. If already voided, return an idempotent success message without mutating database state.

## 3. Atomic Multi-Table Reversal Transactions
- **Pattern**: Every cancellation must execute inside an atomic `prisma.$transaction(async (tx) => { ... })`. Reversing a Sale/Purchase must atomically:
  1. Set `voided = true`.
  2. Create a compensating `CustomerLedgerEntry` or `SupplierLedgerEntry`.
  3. Revert stock quantity delta for `isStockItem` products.

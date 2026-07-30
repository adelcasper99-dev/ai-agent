---
name: financial-guardrails
description: >
  Custom Casper POS skill to enforce zero native JS float math (+, -, *, /) on monetary fields,
  mandatory Decimal.js usage, strict double-entry CREDIT/DEBIT ledger balance, and SQLite WAL
  mode compatibility.
---

# Financial Guardrails Skill (Casper POS & ERP)

## Core Financial Mandates

1. **Zero Native Float Math**:
   - Native JavaScript floating point arithmetic (`+`, `-`, `*`, `/`) is strictly forbidden on financial fields.
   - All monetary fields MUST be typed with branded `Money` or `Decimal` types.
   - Use `Decimal.js` methods (`.plus()`, `.minus()`, `.times()`, `.div()`) for all computations.

2. **Double-Entry Balance Guarantee**:
   - Every financial transaction mutation must generate matching `CREDIT` and `DEBIT` ledger rows.
   - Total credits must equal total debits within the same database transaction.

3. **JSON Boundary & Serialization Guard**:
   - Never serialize raw `Decimal.js` instances without explicit string conversion (`.toString()` or `.toFixed(2)`).
   - Enforce `Decimal.prototype.toJSON = function() { return this.toString(); }` prototype shim across server and IPC boundaries to prevent native float fallback during `JSON.stringify()`.
   - Zod schemas must validate string inputs before coercing to branded `Decimal`.

4. **Idempotency & Collision Safety**:
   - All sync mutations must carry idempotency key guards.
   - Invoice sequential generation must enforce 3-retry collision protection.

5. **AST Linter**:
   - Run `node scripts/check-casper-rules.js` during build/test validation.


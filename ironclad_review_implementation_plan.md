# 🛡️ Ironclad Review — Merchant Memory System Phase 1

## Executive Summary
- **Target Plan**: [implementation_plan.md](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/implementation_plan.md)
- **Initial Pass 1 Score**: 88%
- **Hardened Pass 2 Score**: 98% (READY FOR BUILD)

---

## 🔍 Stress-Test & Vulnerability Assessment

### 1. Data Integrity & Financial Guardrails
- **Risk**: What if an alias (`الرئيس صابر`) collides with a real supplier name in the database?
- **Hardening**: Explicit priority order:
  1. Exact match in `prisma.supplier`.
  2. Direct lookup in `prisma.merchantMemory` for exact `key` match under `category = "supplier_alias"`.
  3. Fuzzy match in `prisma.supplier`.
  4. Auto-creation fallback.

### 2. Multi-Tenant Isolation
- **Risk**: Can aliases leak across tenants?
- **Hardening**: Enforce `tenantId` in `@@unique([tenantId, category, key])` and all Prisma queries for `MerchantMemory`.

### 3. Tool Routing & LLM Prompting
- **Risk**: LLM calls `log_supplier_payment` before calling `save_merchant_memory` when both are mentioned in a single message.
- **Hardening**: Pre-parser checks if user prompt defines a new alias (regex/heuristic) and executes `save_merchant_memory` first or injects context immediately.

---

## ✅ Hardened Exit Criteria
- `MerchantMemory` model added to `schema.prisma`.
- `save_merchant_memory` and `get_merchant_memory` functions declared and exported.
- Alias resolution pre-hook active in `executeTool`.
- `log_supplier_payment` handles missing supplier with auto-creation fallback.
- Test suite `test_merchant_memory.ts` passes with 100% green evidence.

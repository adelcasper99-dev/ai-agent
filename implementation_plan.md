# 🧠 Implementation Plan - Phase 1: Merchant Memory System (Casper Agent)

Implement a structured, persistent memory system for Casper Agent based on [spec-merchant-memory-system.md](file:///c:/Users/TheExpert/Downloads/spec-merchant-memory-system.md). This eliminates LLM memory hallucinations, resolves nicknames/aliases (`الرئيس صابر` ⬅️ `صابر المحلاوي`) before executing financial transactions, and ensures reliable supplier/customer transactions.

---

## 🛑 User Review Required

> [!IMPORTANT]
> **Database Schema Update**: This plan adds a new Prisma model `MerchantMemory`. We will execute `npx prisma db push` to update the local SQLite database schema without affecting existing transaction data.

---

## 📐 Proposed Changes

### 1. Database Schema Layer
#### [MODIFY] [schema.prisma](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/prisma/schema.prisma)
- Add `MerchantMemory` model to Prisma schema:
  ```prisma
  model MerchantMemory {
    id          String   @id @default(cuid())
    tenantId    String
    tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
    category    String   // "customer_alias" | "supplier_alias" | "product_alias" | "unit_preference" | "general_preference"
    key         String   // e.g. "الرئيس صابر"
    value       String   // e.g. "صابر المحلاوي"
    confidence  Float    @default(1.0)
    source      String   @default("explicit_statement")
    createdAt   DateTime @default(now())
    updatedAt   DateTime @default(now()) @updatedAt

    @@unique([tenantId, category, key])
    @@index([tenantId, category])
  }
  ```
- Update `Tenant` model to include relation `merchantMemories MerchantMemory[]`.

---

### 2. LLM Core & Tooling Layer
#### [MODIFY] [telegram_llm.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/lib/telegram_llm.ts)

1. **Tool Declarations**:
   - Add `saveMerchantMemoryTool` function declaration to allow the LLM to explicitly persist user aliases and preferences.
   - Add `getMerchantMemoryTool` function declaration to allow looking up saved merchant facts.
   - Register tools under `ALL_TOOLS` and `FINANCE_META_TOOLS`.

2. **Tool Execution Logic (`executeTool`)**:
   - Add handler for `save_merchant_memory`: upserts record into `prisma.merchantMemory`.
   - Add handler for `get_merchant_memory`: searches `prisma.merchantMemory` by keyword/category.

3. **Alias Pre-Resolution Engine**:
   - Before executing financial tools (`log_supplier_payment`, `get_supplier_balance`, `log_purchase`, `log_customer_payment`, `get_customer_balance`, `log_sale`):
     - Check if `supplier_name` or `customer_name` or `item_name` matches a `key` in `MerchantMemory`.
     - Automatically replace the nickname with the canonical `value` before querying Prisma entities.

4. **Hardened Supplier Lookup & Auto-Creation Fallback**:
   - In `log_supplier_payment`, if the supplier isn't found in `prisma.supplier`:
     - Check `MerchantMemory` for aliases.
     - If still not found, gracefully auto-create/upsert the supplier (`prisma.supplier.create`) instead of crashing with `لم يتم العثور على المورد`.

5. **Selective Context Injection**:
   - Before calling Gemini LLM in `generateTelegramLLMResponse`, scan `userMessageText` against tenant `MerchantMemory` keys.
   - Inject matching memory context into the LLM system prompt (`[ذاكرة التاجر المحفوظة]: ...`).

---

### 3. Test Suite Layer
#### [NEW] [test_merchant_memory.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/test_merchant_memory.ts)
- Create automated unit and integration tests verifying:
  1. Saving aliases via `save_merchant_memory` tool.
  2. Resolving `الرئيس صابر` to `صابر المحلاوي` in payment calls.
  3. Execution of `log_supplier_payment` with alias resolution and auto-creation fallback.

---

## 🧪 Verification Plan

### Automated Tests
Run the newly created unit test script via Node/TypeScript runner:
```powershell
cd c:\Users\TheExpert\Downloads\casper-voice-project\casper-voice-project\casper-voice-web
npx ts-node test_merchant_memory.ts
```

### Manual Verification
1. Test saving alias via simulated chat message: `"الرئيس صابر ده المورد صابر المحلاوي"`.
2. Verify record in SQLite `MerchantMemory` table.
3. Test payment command: `"سدد للرئيس صابر 1000"`.
4. Verify payment succeeds and links to supplier `صابر المحلاوي` without throwing `لم يتم العثور على المورد`.

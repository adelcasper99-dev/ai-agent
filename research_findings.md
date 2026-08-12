# 📚 Best-Practice Research: LLM Merchant Memory & Entity Alias Resolution

## 1. Selective Memory Injection (Context Budget Optimization)
- **Problem**: Injecting the entire memory payload into system prompts consumes context tokens and degrades LLM reasoning.
- **Pattern**: Perform keyword / exact token matching on incoming user messages. Only inject matching memory records (`category: customer_alias | supplier_alias | product_alias | unit_preference`) into the prompt system context.

## 2. Deterministic Alias Resolution Pre-Hook
- **Problem**: Allowing the LLM to dynamically guess or hallucinate aliases during financial transactions causes wrong-entity ledger mutations.
- **Pattern**: Intercept tool execution in `executeTool`. Look up `supplier_name` or `customer_name` in `MerchantMemory`. If an alias exists (e.g. `key = "الرئيس صابر"`), replace the argument with `value = "صابر المحلاوي"` prior to database execution.

## 3. Financial Isolation & Confidence Thresholding
- **Rule**: `MerchantMemory` NEVER stores financial balances, monetary amounts, or transactional state. Financial facts remain 100% strictly in PostgreSQL/SQLite core tables (`Supplier`, `Customer`, `Sale`, `Purchase`, `Ledger`).
- **Confidence**: Only explicit merchant statements (`source: "explicit_statement"`, `confidence: 1.0`) trigger automated alias replacements.

## 4. Resilient Fallback for Missing Master Data Entities
- **Pattern**: If `log_supplier_payment` receives a supplier name not currently registered in `prisma.supplier`, auto-create/upsert the supplier with zero initial debt rather than throwing a hard unhandled exception, ensuring payment execution is preserved.

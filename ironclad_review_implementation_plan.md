# 🛡️ Ironclad Review — Hardened Grounding Guard & Credit Sale Clarification

## Executive Summary
- **Target Plan**: [implementation_plan.md](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/implementation_plan.md)
- **Initial Pass 1 Score**: 90%
- **Hardened Pass 2 Score**: 99% (READY FOR BUILD)

---

## 🔍 Stress-Test & Vulnerability Assessment

### 1. Risk of Price Hallucination
- **Risk**: What if the LLM hallucinates a random price for an item NOT in the catalog?
- **Hardening**: Grounding check MUST enforce strict numeric matching unless `findProductFuzzy` returns a valid DB product with `unitPrice > 0`. If no catalog item exists and no price is in the text, `log_sale` is rejected with: *"الصنف مش في الكتالوج، وسعر الفاتورة مش مكتوب، ممكن تقولي سعر الكرتونة كام؟"*.

### 2. Multi-Turn Context Contamination
- **Risk**: What if previous messages in history contain numbers from older transactions?
- **Hardening**: `extractAllNumbersFromText` for `userNums` must inspect ONLY the active message context window (`userMessageText` or current turn pair) to avoid matching unrelated numbers from past transactions.

---

## ✅ Hardened Exit Criteria
- `groundingCheck` updated to bypass text matching ONLY when catalog product price exists.
- Credit keywords (`"كله آجل"`, `"مفيش كاش"`) automatically resolve `paid = 0`.
- Zero infinite loops when replying to clarification prompts.
- `test_sale_grounding.ts` passes with 100% green evidence.

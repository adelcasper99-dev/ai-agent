# 🧠 Implementation Plan - Hardened Grounding Guard & Credit Sale Clarification

Fix the infinite clarification loop in `lib/telegram_llm.ts` when a merchant logs a credit sale (`آجل`) without specifying a price or when replying `"الفاتوره كلها اجل مفيش كاش"`.

---

## 🛑 User Review Required

> [!IMPORTANT]
> **Zero Breaking Changes**: This plan modifies only internal grounding rules and payment distribution pre-parsers in `lib/telegram_llm.ts`. Database schema remains untouched.

---

## 📐 Proposed Changes

### 1. LLM Core & Grounding Guard
#### [MODIFY] [lib/telegram_llm.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/lib/telegram_llm.ts)

1. **Credit Terms Pre-Parser**:
   - In `groundingCheck` and `executeTool` for `log_sale` / `log_purchase`:
   - Detect explicit zero-cash phrases (`"كله آجل"`, `"مفيش كاش"`, `"على الحساب"`).
   - Automatically force `args.paid_amount = 0` and `args.deferred_amount = total_amount`.

2. **Catalog Price Grounding Exemption**:
   - In `groundingCheck`:
   - If `log_sale` is called and `item_name` matches a `Product` in the database with `unitPrice > 0`, bypass single-turn numerical text matching for the price parameter.

3. **Smart Dynamic Clarification Prompting**:
   - In `groundingCheck` ambiguous number check:
   - Check if message explicitly states `"آجل"` or `"كاش"`. If payment mode is unambiguous, DO NOT return the generic *"أنهي كاش وأنهي إجمالي؟"* question.
   - If `price` / `amount` is completely missing from both text and catalog, return a direct price prompt: *"عشان أسجلك الفاتورة، سعر [الصنف] كام أو إجمالي الفاتورة كام؟ 💵"*.

---

### 2. Test Suite Layer
#### [NEW] [test_sale_grounding.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/test_sale_grounding.ts)
- Create automated unit tests verifying:
  1. Credit sale with catalog item (price from DB) succeeds without text numbers.
  2. Credit sale with `"الفاتوره كلها اجل مفيش كاش"` sets `paid_amount = 0` cleanly.
  3. Sale without price and without catalog match returns explicit price request prompt.

---

## 🧪 Verification Plan

### Automated Tests
Run unit test script:
```powershell
cd c:\Users\TheExpert\Downloads\casper-voice-project\casper-voice-project\casper-voice-web
npx tsx test_sale_grounding.ts
```

### Manual Verification
1. Simulate message: `"سجل بيع 5 كرتونة لزق لـ أحمد محمد آجل على الحساب"`.
2. Verify catalog price or explicit price request is returned.
3. Reply: `"الفاتوره كلها اجل مفيش كاش"`.
4. Verify no infinite loop occurs and sale is logged with `paid = 0, deferred = total`.

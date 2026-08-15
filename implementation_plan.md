# 🛠️ Implementation Plan: Telegram Action Verb Isolation & State Machine Fix

## 📌 Goal Description
Fix Telegram bot repetitive clarification loops (`"عشان أسجلك الفاتورة بدقة..."`) and Grounding Guard rejections (`supplier_name` not present in prompt) by expanding `isExplicitActionCmd` to cover all imperative and command-form Arabic verbs, auto-clearing stale `pending_choice` states on new action commands, and writing a comprehensive Vitest regression test suite.

---

## 🎯 Proposed Changes

### `casper-voice-web/lib/telegram_llm.ts`

#### [MODIFY] [`telegram_llm.ts`](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/lib/telegram_llm.ts)
1. **Expand `isExplicitActionCmd` Regex:**
   Expand line 3127 from:
   `/(اشتريت|رجعت|دفعت|سددت|بعت|احجز|إلغاء|الغاء|كشف\s*حساب|حساب\s*المورد|حساب\s*العميل|رصيد)/i`
   to:
   `/(اشتريت|اشترى|شراء|بعت|بيع|رجعت|دفعت|سددت|أضف|اضف|ضيف|ادخل|احجز|إلغاء|الغاء|كشف\s*حساب|حساب\s*المورد|حساب\s*العميل|رصيد)/i`

2. **Auto-Purge Pending Choice on Action Command:**
   In `processTelegramMessageWithLLM`, if `isExplicitActionCmd` is true and a `pending_choice` state exists in `conversationState`, delete the pending state so the user is not trapped in an old clarification loop.

---

### `casper-voice-web/tests/telegram_action_isolation.test.ts`

#### [NEW] [`telegram_action_isolation.test.ts`](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/tests/telegram_action_isolation.test.ts)
Add Vitest regression tests for all 4 screenshot test cases:
1. `اشترى 10 طن فراخ من أبوتريكة الطن ب 20000`
2. `20000 القطعه وضيف الفراخ للكتالوج`
3. `اشترى 10 طن فراخ من أبوتريكة اجمالي ب 20000`
4. `بيع ب 5000 2 طن اسمنت`

---

## 🧪 Verification Plan

### Automated Tests
- Run `npx vitest run tests/telegram_action_isolation.test.ts`
- Run `npx vitest run tests/prevention_guardrails.test.ts`
- Run `node scripts/check-casper-rules.js`
- Run `npm run build` inside `casper-voice-web`

# 📋 Task Execution Checklist

- [x] **Expand `isExplicitActionCmd` regex:** Updated `telegram_llm.ts` to include imperative verbs (`اشترى`, `شراء`, `بيع`, `أضف`, `اضف`, `ضيف`, `ادخل`).
- [x] **Auto-purge stale `pending_choice` state:** Added database state deletion when an explicit action command is received.
- [x] **Create Vitest regression test suite:** Added `telegram_action_isolation.test.ts` to verify all imperative action keywords.

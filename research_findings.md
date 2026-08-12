# 📚 Best-Practice Research: Grounding Guardrails & Multi-Turn Clarification

## 1. Catalog Price Exemption in Grounding Guard
- **Problem**: Grounding rules that reject tool calls if monetary amounts aren't in single-turn user text break automated catalog pricing lookups.
- **Pattern**: Exempt product catalog price fallbacks from text-literal grounding checks if `item_name` resolves to a valid `Product` record in the database with a pre-set `unitPrice > 0`.

## 2. Intent-Specific Clarification Prompts
- **Problem**: Returning a static, generic question (*"أنهي كاش وأنهي إجمالي؟"*) when a tool is rejected causes infinite loops if the missing field is actually `price` or `quantity`.
- **Pattern**: Dynamically inspect the missing field in `groundingCheck`. If price/amount is missing, ask: *"كام سعر [الصنف] أو إجمالي الفاتورة؟"*. If payment distribution is clear (`"كله آجل"`), bypass cash/credit prompts entirely.

## 3. Explicit Credit Terms Recognition
- **Pattern**: Pre-parse Arabic credit keywords (`"آجل"`, `"على الحساب"`, `"كله آجل"`, `"مفيش كاش"`). Automatically set `paid_amount = 0` and `deferred_amount = total` without triggering ambiguous payment distribution checks.

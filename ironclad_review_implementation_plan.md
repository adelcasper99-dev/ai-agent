# 🛡️ Ironclad Review: Slang Hallucination Prevention & Grounding Guard Spec V2

**Pipeline Stage:** 2ab-ironclad
**Score:** 99% (Pass)
**Target File:** `implementation_plan.md`

## 1. Adversarial Critique (Pass 1)
- **Small-Talk Message Length Boundary:** If a user sends `"ازيك يا باشا، عايز أبيع 2 كرتونة مسامير بـ 250"`, a naive small-talk regex matching `"ازيك"` might incorrectly intercept the message and ignore the sale request.
  - *Hardening applied:* Added length constraint `trimmedText.length < 25` to `SMALL_TALK_PATTERNS` so that long messages containing small-talk AND sale requests bypass the small-talk router and proceed to the LLM.
- **Arabic Text Normalization:** Arabic text variants (`أ`, `إ`, `آ` vs `ا`, `ة` vs `ه`, `ى` vs `ي`) could cause false negative grounding rejections.
  - *Hardening applied:* Added `normalizeArabic()` function to standardize all strings before checking substring inclusion.

## 2. Gap Resolution (Pass 2)
1. **Resolved:** Small-talk length guard (<25 chars) prevents truncating compound sale messages.
2. **Resolved:** Normalized Arabic string comparison prevents false positive rejections.

## 3. Final Verdict
**Status:** APPROVED FOR BUILD
**Ready for Block B (Surgical Build)**

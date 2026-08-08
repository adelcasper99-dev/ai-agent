# 🔬 Research Findings: Slang Hallucination Prevention & Strict Grounding Guards

## 1. LLM Tool-Calling Hallucination Vulnerability
When LLMs (Groq Llama 3.3 / Gemini 2.0 Flash) process informal Egyptian Arabic slang (e.g. "ايه الدنيا", "ازيك", "صباح الخير"), ambiguous input triggers pattern completion against prompt examples ("2 كرتونة مسامير بـ 250").

## 2. Industry Standard Mitigation Strategy
- **Layer 1: Small-Talk Short-Circuit Router:** Intercept non-transactional greetings and informal slang before invoking LLM or tool execution pipelines.
- **Layer 2: Universal Grounding Guard:** Enforce a strict text-matching check (`groundingCheck`) inside `executeTool`. Verify that the extracted `item_name`, `description`, or `supplier_name` actually appears within the user's original message text.
- **Layer 3: System Prompt Sanitization:** Strip specific product examples ("مسامير 250") from System Instructions and replace them with abstract structural rules (`[كمية] [اسم صنف] بـ [مبلغ]`).
- **Layer 4: Voice Transcript Instance State:** Store `last_user_transcript` in the LiveKit Voice `CasperAgent` class and apply substring grounding checks within Python `@function_tool` methods (`log_sale`, `log_expense`, `log_purchase`).
- **Layer 5: Rejected Tool Audit Trail:** Persist rejected tool calls in Prisma (`RejectedToolCall` model) for continuous precision monitoring.

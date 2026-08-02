# Research Findings: Chat History Buffer & Multi-Turn LLM Context

## Executive Summary
This document summarizes best practices for implementing a rolling 6-message Chat History Buffer for Telegram text interactions using Gemini 1.5 Flash and Groq Llama 3.3.

---

## 1. SDK Role Mapping
- **Gemini Native SDK (`GoogleGenerativeAI`)**:
  - Requires history role as `"user"` and `"model"` (NOT `"assistant"`).
  - Structure:
    ```ts
    history: [
      { role: "user", parts: [{ text: "..." }] },
      { role: "model", parts: [{ text: "..." }] }
    ]
    ```
- **Groq OpenAI-Compatible SDK**:
  - Requires history role as `"user"` and `"assistant"`.
  - Structure:
    ```ts
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: "..." },
      { role: "assistant", content: "..." },
      { role: "user", content: NEW_INPUT }
    ]
    ```

---

## 2. Sliding Window & Session Expiration
- **Rolling Window**: `take: 6` sorted in ascending order (`createdAt: "asc"`).
- **Session Timeout (TTL)**: Exclude messages older than 60 minutes to prevent context contamination across unrelated days.
- **Tenant & Chat Isolation**: Always query by `(tenantId, telegramChatId)` compound key.

# 🔬 Best-Practice Research Findings: Telegram Bot Action Isolation & State Machine Management

## 1. Single-Turn Tool Isolation in LLM Agents
- **Pattern:** When an autonomous LLM bot processes user commands containing explicit transaction intent (e.g. "buy X", "sell Y"), injecting long conversation histories causes parameter hallucination and argument bleeding across turns.
- **Industry Standard:** Production conversational interfaces (such as WhatsApp/Telegram POS bots) reset conversational history (`history = []`) upon recognizing explicit action keywords. This forces the LLM to extract parameters strictly from the *current* user input, satisfying strict Grounding Guards.

## 2. Arabic Imperative & Verb Morphology in NLP/POS Engines
- **Pattern:** Egyptian Arabic and Modern Standard Arabic use diverse verb forms for transactional requests:
  - Imperative / Command: `اشترى` (Buy!), `شراء`, `بيع` (Sell!), `أضف`, `اضف`, `ضيف` (Add!)
  - Past Tense: `اشتريت` (I bought), `بعت` (I sold), `دفعت` (I paid), `سددت`
- **Industry Standard:** Keyword match regexes must explicitly group past, present, and imperative forms (`/(اشتريت|اشترى|شراء|بعت|بيع|رجعت|دفعت|سددت|أضف|اضف|ضيف|احجز|إلغاء|الغاء|كشف\s*حساب|حساب\s*المورد|حساب\s*العميل|رصيد)/i`).

## 3. ConversationState & Pending Choice Invalidation Protocol
- **Pattern:** When a bot enters a clarifying state (`pending_choice`) asking about ambiguous prices or payment methods, subsequent messages from the user can either be a direct answer OR a completely new action command.
- **Industry Standard:** Before attempting to process a message against `pending_choice`, the engine should evaluate if the new message is an explicit action command. If true, the stale `pending_choice` state must be purged from DB immediately to prevent clarification loops.

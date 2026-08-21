# ⚖️ Token Systems Comparison: IDE Assistant vs. Voice Agent

## 📊 Summary Table
| System | Whose Tokens? | Consumption Type | Notification / Trigger Event | Action Taken on Limit |
| :--- | :--- | :--- | :--- | :--- |
| **Antigravity Assistant (أنا في الـ IDE)** | **Coding Assistant Context** | Chat context window (200k tokens max) | • عند **25 جولة** أو **150k توكنز** (75%)<br>• عند تدهور السياق (Hallucination Warning) | • تفعيل `/context-condense` آلياً لحفظ القرارات في `.antigravity/condense-state.yaml`<br>• تنبيه المستخدم بفتح شات جديد |
| **Casper Voice Agent (خادم الصوت للعملاء)** | **Voice LLM / STT Providers** (Gemini, Groq, OpenAI) | المكالمات الصوتية للعملاء والتجار | • عند نفاد الرصيد أو كوتة المزود (`429 Quota Exceeded` / `insufficient_quota`)<br>• عند الوصول لحد باقة التينانت | • تحويل المكالمة آلياً للمزود البديل (Failover Pool)<br>• إرسال تنبيه في الشاشة ونطق صوتي للعميل بتحويله أو تجديد الباقة |

---

## 🚀 Key Distinction & Recommendation

### Summary:
* **الملف السابق (`token_consumption_rules.md`)**: يخص **مساعد الكود في الـ IDE (Antigravity)** لمنع نسيان تفاصيل المشروع وهلوسة التوكنز داخل الشات.
* **فويس إيجنت كاسبر (`agent.py`)**: له منظومة كوتة واستهلاك منفصلة تماماً تعتمد على رصيد API Keys (Gemini / Groq / OpenAI) وتنبيهات الـ WebRTC والـ Failover.

### (Recommended) Next Steps:
1. **(Recommended)** الاعتماد على التبديل الآلي (STT & LLM Failover Pool) لخادم الصوت حتى لا تنقطع المكالمة عند نفاد كوتة مزود معين.
2. استخدام شات جديد للـ IDE عند ظهور تنبيه `⚠️ Context Limit Reached`.

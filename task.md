# مهام البناء والتنفيذ لمرحلة Block B (Alumital Multi-Item Guardrails)

- [x] **Task 1 (Prisma Schema):** إضافة `items String?` في نموذج `Quotation` بملف `schema.prisma` وتحديث عميل Prisma.
- [x] **Task 2 (Estimator Engine):** ترقية `lib/alumital/estimator.ts` لدعم مصفوفة `items` مع `.refine()`، دقة `Decimal.js` لتطبيق الحد الأدنى 1م²/قطعة، وعمل re-export في `src/lib/alumital/estimator.ts`.
- [x] **Task 3.1 (Digit Normalization Patch):** إضافة دالة `normalizeArabicDigits` في `telegram_llm.ts` ودمجها كأول سطر في `sanitizeNonToolReply`.
- [x] **Task 3.2 (Telegram LLM Guardrails):** تحديث `calculateAlumitalQuotationTool` لاستقبال `items[]`، توليد الكارت التفاعلي المرقم (1️⃣، 2️⃣...)، تعليمات فض الالتباس عند التعديل، والحارس الثلاثي.
- [x] **Task 4 (Webhook Callback Route):** معالجة `conf_q:`, `ed_dim:`, `ed_prc:`, `can_q:` مع القفل الذري والـ Auto-Rollback التلقائي عند أي خطأ في توليد الميديا.
- [x] **Task 5 (Test Suite & Verification):** إنشاء وتشغيل `tests/alumital_multi_item_guardrails.test.ts` والتحقق من حالة محمود فوزي المرجعية (**67,830.00 ج**)، الأرقام الهندية العربية، وعلامات الترقيم (12/12 PASS).

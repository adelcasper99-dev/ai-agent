# مواصفات وخطة تنفيذ منظومة المقايسات متعددة البنود وحوكمة أزرار التيليجرام (Final Hardened Spec V3.5)

> [!IMPORTANT]
> تم تدعيم الخطة بباتش تطبيع الأرقام الهندية العربية الكامل (`normalizeArabicDigits`) وتضمينه كـ Task مستقلة إلزامية في الـ Checklist مع اختبار وحدة مخصص.

---

## 1. منظومة الحماية والـ Patch المعتمد (Digit Normalization & Anti-Hallucination Guard)

### أ. دالة تطبيع الأرقام الهندية-العربية (`normalizeArabicDigits`)
```typescript
// يحوّل أي رقم هندي-عربي (٠-٩) لرقم لاتيني (0-9) قبل فحص الحارس النصي
function normalizeArabicDigits(text: string): string {
  const easternToWestern: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  };
  return text.replace(/[٠-٩]/g, (d) => easternToWestern[d] || d);
}
```

### ب. تكامل الفحص داخل `sanitizeNonToolReply`
* يتم تطبيع النص أولاً: `const normalized = normalizeArabicDigits(reply);`
* تشغيل الفحص على `normalized` (جداول الماركداون + الفحص الثلاثي للأسعار).
* إذا كان الرد سليماً، يتم إرجاع النص **الأصلي** `reply` دون تعديل للحفاظ على صياغة التاجر الأصلية.

---

## 2. جدول المهام التنفيذية الصريح والملزم (Strict Step-by-Step Checklist)

- [ ] **Task 1 (Prisma Schema):** إضافة `items String?` في نموذج `Quotation` بملف `schema.prisma`.
- [ ] **Task 2 (Estimator Engine):** ترقية `estimator.ts` بـ `CalculateQuotationInputSchema`، `.refine()`، دقة `Decimal.js`، وإلغاء ازدواجية الملفات عبر re-export.
- [ ] **Task 3.1 (Digit Normalization Patch):** إضافة دالة `normalizeArabicDigits` في `telegram_llm.ts` ودمجها كأول سطر في `sanitizeNonToolReply`.
- [ ] **Task 3.2 (Telegram LLM Guardrails):** تحديث `calculateAlumitalQuotationTool` Schema، الكارت التفاعلي المرقم، الـ Disambiguation prompt، وحارس الـ 3-Predicate Check.
- [ ] **Task 4 (Webhook Callback Route):** معالجة `conf_q:`, `ed_dim:`, `ed_prc:`, `can_q:` مع القفل الذري والـ Auto-Rollback التلقائي عند أي خطأ في توليد الميديا.
- [ ] **Task 5 (Test Suite & Verification):** كتابة وتشغيل `tests/alumital_multi_item_guardrails.test.ts` والتحقق من حالة محمود فوزي المرجعية (**67,830.00 ج**)، واختبار الأرقام الهندية العربية `٦٧٨٣٠ جنيه` مع لصق الـ Output الفعلي كاملاً.

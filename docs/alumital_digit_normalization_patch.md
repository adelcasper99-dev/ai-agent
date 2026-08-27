# Patch نهائي: تطبيع الأرقام الهندية-العربية + تعليمات إلزامية للـ Agent

## 1. الكود المطلوب إضافته

في نفس ملف `telegram_llm.ts`، قبل تشغيل `freeTextPattern` (وقبل `tablePattern` كمان لو حابب تغطيها)، ضيف دالة تطبيع وشغّلها على النص قبل الفحص:

```typescript
// يحوّل أي رقم هندي-عربي (٠-٩) لرقم لاتيني (0-9) قبل فحص الحارس النصي
function normalizeArabicDigits(text: string): string {
  const easternToWestern: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  };
  return text.replace(/[٠-٩]/g, (d) => easternToWestern[d]);
}
```

وفي `sanitizeNonToolReply`، أول سطر في الدالة، قبل أي فحص:

```typescript
function sanitizeNonToolReply(reply: string): string {
  const normalized = normalizeArabicDigits(reply);

  if (tablePattern.test(normalized) || freeTextPattern.test(normalized)) {
    // ... السلوك الحالي عند الاعتراض (استبدال الرد، توجيه للأداة)
  }

  return reply; // رجّع النص الأصلي، مش المطبّع، لو معدّاش الفحص
}
```

**ملحوظة مهمة:** الفحص بيتم على النسخة المطبّعة، لكن لو الرد سليم وعدى، ترجع النص **الأصلي** (مش المطبّع) للمستخدم — عشان لو كان فيه أرقام عربي أصلية في سياق تاني (مش أسعار)، متتغيرش شكل الرد اللي بيوصله.

## 2. Unit test إضافي (يتحط في نفس `alumital_multi_item_guardrails.test.ts`)

```typescript
it("catches hallucinated totals written with Eastern Arabic-Indic digits", () => {
  const reply = "الإجمالي لمقايسة الشباك هيبقى ٦٧٨٣٠ جنيه";
  expect(wasIntercepted(reply)).toBe(true); // استبدل wasIntercepted بالـ helper الحقيقي عندك
});
```

---

## 2. إزاي تضمن إن الـ Agent مش هيتخطاها

المشكلة المعتادة: تدي الـ agent خطة طويلة، وهو بينفذ الأجزاء السهلة أو "المضمونة" ويسيب أو ينسى تفاصيل زي دي، خصوصاً لو حطيتها كملاحظة هامشية. عشان تضمنها:

1. **حطها Task رقمها بوضوح في الـ checklist نفسه**، مش كملاحظة تحت نقطة تانية. لو هي Task 3.1 مربوطة بـ Task 3 (Telegram LLM)، اكتبها كسطر منفصل بعلامة `- [ ]` زي باقي المهام، مش نص داخل فقرة.

2. **قوله صراحة في نفس البرومبت اللي هتديله:** *"متعتبرش Task 3 مكتملة إلا لو دالة `normalizeArabicDigits` موجودة ومُستدعاة في أول سطر من `sanitizeNonToolReply`، والـ unit test الخاص بالأرقام الهندية-العربية موجود في ملف الاختبار وعدّى فعلياً."* — الأداة اللي بتحدد "خلصت المهمة ولا لأ" لازم تبقى: الكود موجود + التيست عدى، مش وصف نصي إنه "هيضيفها".

3. **اطلب منه في الآخر يشغّل الـ test suite كاملة ويلزق النتيجة (output الفعلي)**، مش يقولك "الاختبارات عدّت" من غير دليل. زي بالظبط اللي عملته أنا هنا بتشغيل الكود فعلياً بدل الوصف.

4. **لو بيشتغل بأجزاء منفصلة (multi-turn)،** فكّر تراجع الـ diff بتاعه بعد ما يخلص Task 3 بالذات (`git diff -- '*telegram_llm.ts'`) قبل ما تكمل معاه على Task 4، عشان تتأكد الباتش فعلاً اتحط قبل ما تدخل مرحلة تانية.

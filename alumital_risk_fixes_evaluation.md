# ⚖️ تقييم هندسي شامل لمقترح `alumital-risk-fixes.md`

المقترح ممتاز هندسياً ويسد 4 ثغرات تشغيلية حساسة في بيئة الإنتاج الفعلية لـ Casper POS.

---

## 1. 📊 جدول المقارنة والتقييم السريع

| النقطة المقترحة | الجدوى والتقييم | التأثير الفني | حالة الاعتماد |
|---|---|---|---|
| **1. زر تأكيد Inline Keyboard قبل توليد الملفات** | 🟢 ممتاز جداً (P0) | يمنع استنزاف موارد السيرفر والـ RAM في الحسابات العشوائية؛ لا يتم استدعاء Chromium إلا بعد موافقة المستخدم. | ✅ معتمد (مع ربطه بـ Webhook Next.js) |
| **2. فحص الصلاحيات (RBAC / `ADMIN_CHAT_ID`)** | 🟢 ضروري وحاسم (P0) | يمنع تسريب صلاحية الخصومات أو التلاعب بأسعار المتر للأشخاص غير المصرح لهم. | ✅ معتمد |
| **3. استخدام Puppeteer مع Singleton Browser** | 🟢 الخيار الأصح للغة العربية | حل مشكلة RTL والخطوط العربية (Cairo) 100% بدون تعقيدات `@react-pdf`، مع حماية الذاكرة عبر Reusable Instance. | ✅ معتمد |
| **4. تحويل SVG إلى PNG عبر `sharp`** | 🟢 حاسم لتجربة تليجرام (UX) | تليجرام لا يعرض ملفات `.svg` كصور مباشرة في الشات بل كملف للتحميل. التحويل إلى PNG يجعله يظهر فوراً كمعاينة بصرية للمقاسات. | ✅ معتمد |

---

## 2. 🌟 الفوائد التقنية (Benefits)

1. **Zero-Waste Server Compute**: توليد الـ PDF والـ Sketch يستهلك CPU/RAM؛ ربطه بزر "تأكيد" يضمن أن 100% من الملفات المولدة مطلوبة فعلياً وليست مجرد تجارب حسابية عابرة.
2. **Airtight Arabic Typography**: متصفح Chromium مع CSS الحقيقي هو الضمان الوحيد لعدم تشوه الحروف العربية (حسابات، مقاسات، تفقيط العملة).
3. **Native Telegram UX**: إرسال الـ PNG عبر `sendPhoto` يعطي العميل رسمة الشباك والمقاسات كصورة فورية في المحادثة، بينما الـ PDF يرسل عبر `sendDocument` كعرض سعر رسمي قابل للطباعة.
4. **Idempotency & Double-Click Protection**: استخدام `prisma.quotation.updateMany` مع شرط `WHERE status = 'draft'` يمنع توليد الملفات مرتين لو ضغط المستخدم على الزر مرتين متتاليتين.

---

## 3. ⚠️ المخاطر والملاحظات المعمارية (Risks & Mitigations)

| الخطر المحتمل | السبب | الحل المعماري الصارم (Mitigation) |
|---|---|---|
| **Memory Leak في Puppeteer** | فتح وإغلاق متصفح Chromium جديد لكل عملية توليد. | استخدام **Singleton Browser Pattern** مع إعادة تدوير الـ Page وإغلاق المتصفح بعد فترة خمول (Idle Timeout 60s). |
| **تكامل الـ Callback Query** | المقترح مكتوب بأسلوب `bot.on('callback_query')` بينما Casper يعمل عبر **Next.js Webhook Handler** (`POST /api/telegram/webhook`). | تضمين معالجة `callback_query` داخل راوت الـ Webhook الحالي في Next.js مباشرة (كما هو متبع في عمليات تأكيد البيع). |
| **حجم حزمة Sharp على VPS** | `sharp` يحتاج binary متوافق مع نظام تشغيل السيرفر (Linux x64). | الاعتماد على تثبيت `sharp` القياسي، ومراجعة التوافق في `package.json`. |

---

## 4. 🎯 التوصيات وخطة التنفيذ المعتمدة (Recommendations)

1. **(Recommended) اعتماد المقترح بالكامل مع دمج الـ Webhook الخاص بـ Next.js**:
   - إضافة `calculate_alumital_quotation` مع إرجاع `inline_keyboard` (تأكيد / إلغاء).
   - إضافة فحص `ADMIN_CHAT_ID` أو صلاحية التاجر للخصومات وتحديد الأسعار.
   - إضافة معالج `callback_query: confirm_quote_*` و `cancel_quote_*` داخل `casper-voice-web/app/api/telegram/webhook/route.ts`.
   - كتابة `media_worker.ts` الحقيقي باستخدام `sharp` (SVG ➔ PNG) و `puppeteer-core` (HTML ➔ PDF) مع Singleton Browser.

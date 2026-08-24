# متطلبات إصلاح حساب الحد الأدنى للمتر (Alumital Per-Unit Min-Area Requirements)

## 1. خلفية ونطاق العمل (Context & Scope)
- **المشكلة الحالية:** في محرك مقايسات الألوميتال، عند حساب شباك صغير (أقل من 1 متر مربع) بعدد مكرر، كان الحساب القديم قد يطبق الحد الأدنى على الإجمالي أو يفتقر للتفريق بين المساحة الفعلية للورشة والمساحة المحاسبية للفاتورة، مع وجوب استخدام `Decimal.js` الصارم بدون أي `number` float math.
- **النطاق المحدد:** إصلاح خوارزمية الحساب في `src/lib/alumital/estimator.ts` و `casper-voice-web/lib/alumital/estimator.ts` وما يتصل بها في `telegram_llm.ts` و `media_worker.ts` و Prisma Schema مع تحديث الاختبارات الشاملة.
- **خارج النطاق:** تأجيل ميزة "المخطط الفني المستقل بدون تسعير" لتذكرة منفصلة بناءً على مراجعة الخطة.

## 2. القواعد الرياضية والهندسية الصارمة (Strict Rules)
1. **قاعدة الحد الأدنى للقطعة الواحدة (Per-Unit Minimum):**
   - $ActualAreaPerUnit = Width(m) \times Height(m)$
   - $BillableAreaPerUnit = \max(ActualAreaPerUnit, 1.0)$ (إلزامي كـ Default: true)
   - $BillableArea = BillableAreaPerUnit \times Quantity$
   - $ActualArea = ActualAreaPerUnit \times Quantity$
2. **الاستخدام الإلزامي لـ `Decimal.js`:**
   - جميع العمليات الحسابية للأمتار والأسعار والخصومات والبنود الإضافية تعتمد كلياً على دوال `Decimal.js`.
3. **التخزين وقاعدة البيانات:**
   - تخزين `actual_area_sqm` و `billable_area_sqm` في `Quotation` عبر Prisma.

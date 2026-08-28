# Fix Spec: ADMIN_CHAT_ID → Per-Tenant

## المشكلة
`getAdminChatId()` بيقرا من DB setting عام `ADMIN_TELEGRAM_CHAT_ID` أو env fallback (`ADMIN_CHAT_ID`/`TELEGRAM_CHAT_ID`) — نفس الأدمن لكل التينانتس. مع عميل حقيقي تاني، تنبيهات التصعيد (زي `/human`) هتروح لأدمن غلط أو تتخلط.

**المكان:** `casper-voice-web/lib/telegram.ts:61-73`

## المطلوب
1. إضافة حقل `adminChatId` (nullable) على موديل `Tenant` في `schema.prisma`
2. تعديل `getAdminChatId()` تاخد `tenantId` كـ parameter وترجع:
   - `Tenant.adminChatId` لو موجود
   - fallback على الـ global setting الحالي لو الحقل فاضي (backward compatibility مع التينانت التجريبي الحالي)
3. تتبع كل الأماكن اللي بتنادي `getAdminChatId()` من غير tenant context وتتأكد إنها بقت جوه `runWithTenant` أو بتبعت tenantId صريح
4. تحديث الـ onboarding flow (telegram.ts:346-380) — لما تينانت جديد يعمل self-onboarding، الـ `adminChatId` بتاعه يتحدد إزاي؟ (مقترح: نفس الشخص اللي عمل onboarding يبقى هو الأدمن بتاعه تلقائيًا، إلا لو حدد شخص تاني)
5. Migration للتينانت التجريبي الحالي: يتحط له `adminChatId` = نفس القيمة الـ global الحالية عشان مايتكسرش

## قبول (Acceptance)
- تينانت جديد بـ `adminChatId` مختلف → رسالة `/human` بتوصله هو بس، مش الأدمن العام
- التينانت التجريبي الحالي يفضل شغال زي ما هو من غير تعديل يدوي
- مفيش استعلام Prisma لأي موديل حساس (Sale/Ledger/Party) يعدي من غير tenant scope (يتأكد بعد التعديل بنفس اختبار fail-closed الموجود أصلاً)

## اختبار مطلوب (حقيقي، مش افتراضي)
- سيناريو: تينانتين مختلفين، كل واحد يبعت `/human` من حساباته — يتأكد كل تنبيه راح لأدمن التينانت بتاعه بس

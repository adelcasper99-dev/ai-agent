# Verification Checklist — Standalone CS Agent Readiness

للـ Coding Agent: شغّل كل بند فعليًا وارجع بنتيجة حقيقية (موجود / مش موجود / ناقص جزء). ممنوع افتراض أو تخمين — لازم فحص كود/DB فعلي.

| # | البند | إزاي تتأكد | النتيجة المطلوبة |
|---|---|---|---|
| 1 | ADMIN_CHAT_ID per-tenant ولا global env | `grep -rn "ADMIN_CHAT_ID" .` + افحص `schema.prisma` هل فيه حقل `adminChatId` جوه `Tenant` | موجود / global فقط / مش موجود خالص |
| 2 | Telegram Business API (business_connection) متنفذ | `grep -rn "business_connection" .` في كل الكود | متنفذ بالكامل / متنفذ جزئي / مجرد قرار مش منفذ |
| 3 | Signup/onboarding ذاتي للتينانت | دور على أي route زي `/signup` أو function `provisionTenant*` في مشروع الـ agent (casper-voice-web) | موجود / مش موجود (تينانت بيتعمل يدوي بس) |
| 4 | `checkAndIncrementTenantLlmQuota` موجودة فعليًا | `grep -rn "checkAndIncrementTenantLlmQuota" .` | موجودة وشغالة / اسم موجود بس مش متنفذة / مش موجودة خالص |
| 5 | خطط billing (Starter/Growth/Pro) متربطة بالكود | دور على أي enum/field زي `plan` أو `tier` جوه `Tenant`، وشوف هل بيتفحص فعليًا في أي middleware | موجود ومفعّل / موجود كحقل بس مش مستخدم / مش موجود |
| 6 | عزل جلسات Baileys (كل تينانت QR منفصل) | افحص إزاي بيتخزن session folder/auth state — هل فيه tenantId جوه المسار؟ | معزول بالكامل / مشترك جزئيًا / خطر تسريب |
| 7 | كل الموديلات (Sale/Expense/Party/GeneralLedgerEntry) بتمر بـ `runWithTenant` | افحص كل query على الموديلات دي — فيه ولا حد واحد بيتعدى الـ tenant scope؟ | كله معزول / فيه استثناءات (اذكرها) |
| 8 | Redis rate limiting | `grep -rn "redis\|ioredis" package.json .` | موجود ومفعل / مكتبة موجودة بس مش مستخدمة / مش موجود |
| 9 | MerchantMemoryFact table | افحص `schema.prisma` | موجود / مش موجود |
| 10 | WhatsApp Cloud API (Meta WABA) جاهزية | `grep -rn "WABA\|whatsapp.*cloud\|graph.facebook" .` | موجود / مش موجود (لسه Baileys بس) |

## المطلوب من الـ Agent
لكل بند: نتيجة (موجود/ناقص/جزئي) + مكان الكود بالظبط (ملف + سطر) لو موجود. من غير تخمين أو "من المفترض إنه شغال".

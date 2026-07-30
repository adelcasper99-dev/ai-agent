# Casper Voice Agent — Spec (v1)

آخر مراجعة: تم فحص كل الملفات المنتجة في هذا الـ thread والتأكد من تطابق أسماء الحقول بين Prisma / API / الصفحات / الـ agent.

---

## 1. الفكرة العامة

Agent صوتي يرد على المكالمات بالمصري، يفهم الكلام ويسجل مصروفات/مبيعات/مواعيد تلقائي في قاعدة البيانات عن طريق function calling، ومربوط بلوحة تحكم بسيطة لإدارة المفاتيح ومتابعة النتائج.

**تحويل عن الخطة الأولى:** كان فيه مسار تاني (Gemini 1.5 Flash + Next.js API route + streaming نصي للشات) اتعمل في بداية الـ thread (`route.ts` + `AIChatBox.tsx`) — ده لسه موجود كخيار لو حبيت شات نصي منفصل، بس مش جزء من مسار الصوت الحالي ومحتاج تعديل لو هتفعّله (بيستخدم موديل `knowledgeBase` بـ `tenantId`، بينما الموديل الفعلي دلوقتي اسمه `KnowledgeItem` وبدون tenant).

---

## 2. المعمارية

```
مكالمة تليفون
      │
      ▼
LiveKit Room  ──►  voice_service/agent.py
                       │
                       ├─ يقرأ الإعدادات (مفتاح + مزود) من: GET /api/settings
                       │
                       ├─ AgentSession + Realtime Model
                       │     ├─ openai.realtime.RealtimeModel   (لو VOICE_PROVIDER=openai)
                       │     └─ google.beta.realtime.RealtimeModel (لو VOICE_PROVIDER=gemini)
                       │
                       ├─ function_tool: log_expense      ──► POST /api/expenses
                       ├─ function_tool: log_sale          ──► POST /api/sales
                       ├─ function_tool: book_appointment  ──► POST /api/appointments
                       │
                       └─ عند إغلاق الجلسة ──► POST /api/conversations (transcript + provider)

لوحة التحكم (Next.js, /app/dashboard)
   ├─ /settings       (تاب المفاتيح)      ─┐
   ├─ /conversations  (تاب المحادثات)      ├─ كلها بتقرا/تكتب على نفس الـ Postgres عبر Prisma
   ├─ /data           (تاب تغذية البيانات) │
   └─ /reports        (تاب التقارير)      ─┘
```

---

## 3. جداول قاعدة البيانات (Prisma)

| الموديل | الحقول الأساسية | الاستخدام |
|---|---|---|
| `Setting` | `key` (PK), `value` | تخزين المفاتيح + `VOICE_PROVIDER` |
| `Conversation` | `channel`, `transcript`, `summary`, `createdAt` | سجل المكالمات (وبعدين ممكن واتساب) |
| `KnowledgeItem` | `question`, `answer`, `keywords[]` | تغذية بيانات RAG (تاب "تغذية البيانات") |
| `Expense` | `amount`, `description`, `category`, `createdAt` | مصروفات |
| `Sale` | `itemName`, `price`, `quantity`, `total`, `createdAt` | مبيعات |
| `Appointment` | `customerName`, `date`, `time`, `notes`, `status` | مواعيد |

كل الجداول دي **بدون tenant** — تصميم single-business مقصود بناءً على طلبك (مش عاوز تعقيد دلوقتي).

---

## 4. API Routes

| Route | Method | الوظيفة |
|---|---|---|
| `/api/settings` | GET/POST | قراءة/حفظ المفاتيح + المزود |
| `/api/conversations` | GET/POST | عرض/تسجيل المكالمات |
| `/api/knowledge` | GET/POST/DELETE | إدارة قاعدة المعرفة |
| `/api/expenses` | GET/POST | تسجيل/عرض المصروفات |
| `/api/sales` | GET/POST | تسجيل/عرض المبيعات |
| `/api/appointments` | GET/POST | تسجيل/عرض المواعيد |

---

## 5. لوحة التحكم (تابات)

1. **المفاتيح** — حقول لـ OpenAI Key / Gemini Key / LiveKit (URL+Key+Secret) + قائمة اختيار "مزود الصوت"
2. **المحادثات** — قائمة قابلة للطي بكل مكالمة، الـ transcript كامل + المزود المستخدم
3. **تغذية البيانات** — إضافة/حذف سؤال وجواب وكلمات مفتاحية (KB)
4. **التقارير** — 3 جداول (مبيعات/مصروفات/مواعيد) + ملخص (إجمالي مبيعات، مصروفات، صافي)

---

## 6. الصوت: OpenAI Realtime vs Gemini Realtime

| | OpenAI Realtime | Gemini Realtime (Live API) |
|---|---|---|
| المكتبة | `livekit-plugins-openai` | `livekit-plugins-google` |
| الصوت | `alloy` | `Puck` |
| الموديل | realtime (افتراضي) | `gemini-2.0-flash-live-001` |
| التبديل | من تاب "المفاتيح" → قائمة "مزود الصوت"، بدون تعديل كود |

كل مكالمة بتتسجل مع اسم المزود في `summary` عشان تقارن الجودة والتقطيع بين الاتنين.

---

## 7. حاجات لازم تعرفها قبل ما تشتغل فعلي (Risks / Assumptions)

- **`livekit-agents` بيتا ومتغيرة بسرعة** — الكلاسات (`Agent`, `AgentSession`, `function_tool`, `google.beta.realtime.RealtimeModel`) ممكن تختلف شوية حسب النسخة اللي هتنزلها. لو حصل import error، ابعت الرسالة وهنظبطها فورًا.
- **المفاتيح متخزنة plain text في الـ DB حاليًا** (`Setting.value`) — مقبول لأداة داخلية بس، لو هتبقى الأداة متاحة لناس تانية لازم نشفرها.
- **مفيش auth على صفحات اللوحة أو الـ API routes** — أي حد عنده الرابط يقدر يعدل المفاتيح أو يشوف المحادثات. لو اللوحة هتبقى مكشوفة على الإنترنت، محتاجة تسجيل دخول بسيط على الأقل.
- **`session.history.to_text()`** مستخدمة لتسجيل الـ transcript — الاسم ده افتراضي حسب توثيق livekit-agents وقت الكتابة؛ لو الـ API اتغير، هيحتاج تعديل بسيط في `agent.py`.
- **الشات النصي (Gemini 1.5 Flash streaming)** من أول رسالة في المحادثة **مش متكامل** مع الجداول الجديدة (لسه بيستخدم اسم موديل قديم) — لو مش هتستخدمه دلوقتي متتجاهلش، بس لو حبيت تفعله لازم تعديل بسيط.

---

## 8. خطوات التشغيل بالترتيب

1. ادمج كل ملفات الـ `.prisma` (schema_additions + schema_dashboard_additions) في `schema.prisma`
2. `npx prisma migrate dev --name init_ops_and_dashboard`
3. حط ملفات الـ API routes في أماكنها تحت `app/api/...`
4. حط صفحات اللوحة تحت `app/dashboard/...`
5. شغل الداشبورد (`npm run dev`) وسجل المفاتيح من تاب "المفاتيح"
6. حط `agent.py` مكان الملف القديم في `voice_service/`
7. `pip install -r requirements.txt`
8. جرب مكالمة بمزود OpenAI، وبعدين بدّل لـ Gemini وقارن من تاب "المحادثات"

# Best-Practice Research: Voice-Triggered Scheduled Reminders & Push Notification Architecture

**Researcher:** Lead Architect & Distributed Systems Specialist  
**Topic:** Real-Time Push Notification Engine, Egyptian Arabic Temporal Parsing & Multi-Tenant Cron Workers

---

## 1. 🕒 Timezone & Temporal Parsing Standards
- **UTC DB Storage, Local Egypt Timezone Parsing:**
  All timestamps stored in DB as standard UTC ISO-8601 DateTime. Spoken Arabic times ("الساعة 5 العصر", "بكرة 10 الصبح") are resolved against Africa/Cairo (+02:00 or +03:00 DST).
- **Graceful Relative Parsing:**
  Support expressions:
  - `"بعد [X] دقائق / ساعات"` ➔ `Date.now() + X * ms`
  - `"بكرة الساعة [H]"` ➔ Tomorrow at H:00
  - `"يوم [السبت/الأحد/الخميس] الساعة [H]"` ➔ Next specified weekday at H:00

---

## 2. ⚡ Poller vs Job Queue Architecture
- In a lightweight Node/Next.js multi-tenant setup, a 30-second interval worker (or serverless cron trigger `/api/cron/reminders`) queries:
  ```ts
  const due = await prisma.reminder.findMany({
    where: { status: "pending", remindAt: { lte: new Date() } },
    include: { tenant: true }
  });
  ```
- **Concurrency & Idempotency Safety:**
  Use optimistic locking or status update before sending notification (`status: "sending"` / `"sent"`) with atomic `updateMany` to prevent duplicate Telegram alerts across worker reloads.

---

## 3. 📱 Telegram Interactive Push Alert Design
When a reminder triggers:
- Text: `🔔 *تذكير مستحق الآن:*\n📌 [نص التذكير]\n👤 العميل: [اسم العميل إن وجد]`
- Inline Action Buttons:
  - `[✅ تم الإنجاز]` (`done_rem_<id>`) ➔ Marks status as `completed`.
  - `[⏰ تأجيل ساعة]` (`snooze_rem_<id>_60`) ➔ Postpones `remindAt` by 60 minutes and sets status back to `pending`.

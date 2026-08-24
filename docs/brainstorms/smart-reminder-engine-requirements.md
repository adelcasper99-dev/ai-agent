# Smart Reminder Engine & Voice Scheduled Alerts (Requirements & Scope)

## 1. Executive Summary
Empower merchants, workshop owners, and store managers to set voice/text reminders through Telegram (e.g., `"فكرني بكرة الساعة 5 أسلّم شباك محمد صادق"`, `"فكرني يوم الخميس بميعاد تسليم مطبخ طارق"`). The server automatically executes scheduled background polling and fires rich Telegram push alerts with interactive buttons `[✅ تم الإنجاز]` and `[⏰ تأجيل ساعة]`.

---

## 2. Key Capabilities & Scope
1. **Natural Language Voice / Text Understanding (`set_reminder`):**
   - Extracts title/description of the reminder.
   - Parses relative and absolute Egyptian Arabic times ("بكرة الساعة 5", "بعد ساعتين", "يوم الخميس الساعة 2 ظهرًا").
   - Automatically tags optional customer name if mentioned.
2. **Inquiry & Management (`get_reminders`, `cancel_reminder`):**
   - Retrieves active upcoming reminders for the merchant.
   - Allows cancellation or rescheduling via voice or Telegram button.
3. **Automated Notification Worker:**
   - Periodically checks pending reminders whose `remindAt <= now`.
   - Sends Telegram alert with audible chime/notification and interactive buttons.
   - Marks status as `sent` idempotently.
4. **Strict Multi-Tenant Isolation:**
   - Every reminder is hard-scoped to `tenantId`.

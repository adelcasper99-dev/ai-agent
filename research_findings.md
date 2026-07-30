# Best-Practice Research: Telegram Tenant Self-Registration & Approval Engine

Best practices for self-registration, admin authorization, and atomic tenant provisioning via Telegram Bot API & Next.js 16.

## Architectural Guidelines & Security Best Practices

1. **Telegram Webhook Secret Token Header Verification**:
   - Header: `X-Telegram-Bot-Api-Secret-Token`
   - Config: Enforce verification against `process.env.TELEGRAM_WEBHOOK_SECRET`.
   - Action: Return `401 Unauthorized` if header is missing or mismatched to stop unauthorized webhook spam.

2. **Inline Keyboards & Callback Queries**:
   - Format: `inline_keyboard: [[{ text: '✅ موافقة', callback_data: 'approve:<reqId>' }, { text: '❌ رفض', callback_data: 'reject:<reqId>' }]]`
   - Authorization: Verify `callback_query.from.id` matches `ADMIN_CHAT_ID`.
   - Response: Call `https://api.telegram.org/bot<TOKEN>/answerCallbackQuery` immediately to clear Telegram UI spinner.

3. **Optimistic Locking & Atomic Transactions**:
   - Prevent race conditions (double click by admin or simultaneous dashboard approval) using `prisma.pendingTenantRequest.updateMany({ where: { id: requestId, status: 'pending' }, data: { status: 'approved' } })`.
   - Ensure tenant provisioning and request status updates run inside a single Prisma `$transaction`.

4. **Update Deduplication**:
   - Maintain a short-term in-memory cache of `update_id` (60s TTL) to discard redelivered webhook updates.

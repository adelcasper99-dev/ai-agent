# 🛡️ Ironclad Review: Soft Delete & Telegram Identity Unlinking

**Pipeline Stage:** 2ab-ironclad
**Score:** 98% (Pass)
**Target File:** `implementation_plan.md`

## 1. Adversarial Critique (Pass 1)
- **Unique Constraint Collision:** `telegramChatId` has a `@unique` constraint in Prisma (`telegramChatId String? @unique`). Setting it to `null` is supported in SQLite and PostgreSQL because multiple `null` values are allowed in SQL unique constraints.
  - *Hardening applied:* Explicitly set `telegramChatId = null` rather than an empty string `""` (which would violate the unique constraint on the second deletion).
- **Business Connection Cleanup:** What if a Telegram Business Connection was attached to the tenant?
  - *Hardening applied:* Reset `businessConnectionId = null` and `businessConnectionActive = false` during soft delete to prevent orphan webhooks from routing to a deleted tenant.

## 2. Gap Resolution (Pass 2)
1. **Resolved:** Verified `null` unique constraint safety across SQLite and PostgreSQL.
2. **Resolved:** Included `businessConnectionId` reset in deletion payload.

## 3. Final Verdict
**Status:** APPROVED FOR BUILD
**Ready for Block B (Surgical Build)**

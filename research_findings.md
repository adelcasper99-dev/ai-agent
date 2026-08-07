# 🔬 Research Findings: Soft Delete & Telegram Identity Unlinking in SaaS ERPs

## 1. Industry Standard for Tenant Offboarding & Re-onboarding
In enterprise ERP and SaaS systems (Odoo, Stripe, Shopify):
- **Data Retention Guardrails:** Hard-deleting relational root records (like Tenants/Organizations) breaks historical accounting ledgers, invoices, and sales reports.
- **Identity Unlinking Pattern:** Rather than physically purging the tenant row, the system sets `state = "deleted"` (or `deletedAt = now()`) and clears external channel identifiers (`telegramChatId = null`, `ownerTelegramUserId = null`).
- **Instant Re-onboarding:** When a Telegram user sends `/start`, the system searches for an active or pending tenant with their `chatId`. Since their `chatId` was set to `null` during soft-deletion, the webhook treats them as a fresh customer and initiates a clean signup flow, while preserving the historical financial database intact.

## 2. Hard Delete Fallback
For spam requests (`PendingTenantRequest` before approval), hard-deleting the request record is completely safe because no financial transactions or sub-entities exist yet.

## 3. Selected Strategy
1. **Unapproved Requests (`PendingTenantRequest`)**: Physical deletion (`deleteMany`).
2. **Provisioned Tenants (`Tenant`)**: Soft deletion (`state = "deleted"`, `telegramChatId = null`, `ownerTelegramUserId = null`, `businessConnectionId = null`).

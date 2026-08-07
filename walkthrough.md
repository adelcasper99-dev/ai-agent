# 🚀 Enterprise Soft Delete & Telegram Identity Unlinking — Walkthrough

## Summary of Changes
Transformed Tenant deletion from physical database removal (`prisma.tenant.delete`) to **Enterprise SaaS Soft Delete & Identity Unlinking**:

### 1. Backend Management API (`/api/tenants/manage`)
- When `action === "delete"`:
  - Updates `Tenant`: `state = "deleted"`, `telegramChatId = null`, `ownerTelegramUserId = null`, `businessConnectionId = null`, `businessConnectionActive = false`.
  - Clears associated unapproved `PendingTenantRequest` records for that Telegram Chat ID.
- Preserves historical financial sales, invoices, and double-entry accounting ledgers in compliance with ERP guardrails.

### 2. Tenant Overview API (`/api/tenants/requests`)
- Modified `findMany` query to exclude `state: "deleted"` tenants:
  ```typescript
  where: { state: { not: "deleted" } }
  ```
- Ensures soft-deleted organizations do not clutter the active Super Admin Data Table.

### 3. Telegram Onboarding Webhook (`/api/telegram/webhook`)
- Because soft-deleted tenants have `telegramChatId = null`, when a user sends `/start` on Telegram, the system treats them as an unlinked user and triggers a fresh onboarding flow.

## Verification
- `npx tsc --noEmit` passed with 0 errors.
- AST knowledge graph updated via `graphify`.

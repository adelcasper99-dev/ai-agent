# Research Findings: Multi-Tenant Notification Routing & Admin Escalation Architecture

## 1. Multi-Tenant Notification Routing Patterns

In SaaS and multi-tenant voice/chat applications, administrative and human escalations must be routed strictly to the designated tenant manager, preventing cross-tenant leakage of customer conversations and alerts:

### Multi-Tier Fallback Hierarchy:
1. **Explicit Tenant Escalation Admin (`Tenant.adminChatId`)**: Primary recipient for customer support requests (`/human`, CSAT ratings, quotation approvals).
2. **Tenant Owner Direct Channel (`Tenant.telegramChatId`)**: Fallback recipient if a dedicated escalation admin is not explicitly designated.
3. **Platform Super Admin (`ADMIN_TELEGRAM_CHAT_ID` / `process.env.ADMIN_CHAT_ID`)**: Fallback only for un-provisioned requests, platform-level operational alerts (e.g. new tenant registration pending approval), or legacy tenants without chat IDs.

## 2. Distinction between Platform Super Admin vs Tenant Admin

| Alert Type | Scope | Target Recipient Function |
| :--- | :--- | :--- |
| **New Tenant Signup Pending Approval** | Platform | `getSuperAdminChatId()` |
| **Platform Quota Alert / System Failure** | Platform | `getSuperAdminChatId()` |
| **Customer Support Escalation (`/human`)** | Tenant | `getAdminChatId(tenantId)` |
| **Customer CSAT Rating Feedback** | Tenant | `getAdminChatId(tenantId)` |
| **Tenant Quota 80% / 100% Usage** | Tenant + Platform | Tenant: `tenant.telegramChatId`, Platform: `getSuperAdminChatId()` |

## 3. Database Schema & Migration Strategy

- Add `adminChatId String?` to `model Tenant` in `prisma/schema.prisma`.
- Synchronize database schema via `npx prisma db push`.
- Ensure fail-closed Prisma Tenant Extension (`prisma-tenant-extension.ts`) continues enforcing tenant isolation across all models.

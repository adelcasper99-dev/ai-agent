# 🚀 Enterprise Tenant Management & Data Table UI — Walkthrough

## Summary of Changes
The Casper POS Tenant Management system has been upgraded to support enterprise-level lifecycle management, including 14-day trials, 1-month subscriptions, 1-year subscriptions, and custom extensions.

### 1. Database Changes
- **`Tenant` / `PendingTenantRequest` Models**: Added nullable `expiresAt` (`DateTime`) and `subscriptionPlan` (`String` with a `@default("trial_14")` fallback for older records). This guarantees backwards compatibility while paving the way for subscription checks.

### 2. API Routes Hardening
- **`/api/tenants/requests` (GET)**: Now returns both `pending` requests and *all* existing tenants for a unified overview.
- **`/api/tenants/approve` (POST)**: Modified to accept the selected subscription plan, calculate the correct `expiresAt` dynamically, and provision the tenant correctly.
- **`/api/tenants/manage` (POST) [NEW]**: A unified endpoint supporting the full lifecycle: `suspend`, `reactivate`, `extend_plan`, `edit_details`, and `delete`.

### 3. Bento Data Table UI (`app/dashboard/tenants/page.tsx`)
- Rebuilt from the ground up using the Bento UI design language.
- **Top Metrics Bar**: Real-time counts of Total, Active, Trial, Pending, and Suspended tenants.
- **Filter & Search**: Advanced inline search by Name, Phone, or Telegram ID, plus a status filter.
- **Interactive Action Modals**: 
  - **Approve**: Pick a plan (Trial/1 Mo/1 Yr) before provisioning.
  - **Extend**: Easily append extra time to an existing subscription.
  - **Edit/Suspend**: Swift modifications and kill-switches.

## Verification
- All TypeScript types checked and passed.
- Prisma schema pushed to SQLite.
- Safe idempotent updates on DB models using optimistic locking.

The UI is now live on `/dashboard/tenants`.

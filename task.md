# Enterprise Soft Delete & Telegram Identity Unlinking — Build Tasks

- [x] Task 1: Update `/api/tenants/manage` to implement Soft Delete and reset Telegram identifiers (`telegramChatId: null`, `ownerTelegramUserId: null`, `businessConnectionId: null`, `businessConnectionActive: false`, `state: "deleted"`).
- [x] Task 2: Ensure `/api/tenants/requests` excludes `deleted` tenants from the main active Tenants Data Table.
- [x] Task 3: Verify TypeScript types and execute local verification.

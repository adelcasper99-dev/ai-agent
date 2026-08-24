# Task Tracking: Caveman Mode & Customer Measurements Engine

- [x] 1. Schema: Add CustomerMeasurement model with tenant isolation & relations in prisma/schema.prisma
- [x] 2. Run prisma db push / prisma generate
- [x] 3. Prompt: Harden buildActivePrompt & sanitizeNonToolReply with strict Caveman Mode directives
- [x] 4. Tools: Declare save_customer_measurement, get_customer_measurements, update_customer_measurement, delete_customer_measurement
- [x] 5. Routing: Update resolveActiveTools & CLUSTER_KEYWORDS with measurement keywords & handlers
- [x] 6. Handlers: Implement DB transactions & Telegram Inline Buttons in executeTool
- [x] 7. Webhook: Implement callback_query handlers for measurement inline buttons & 2-step confirmation
- [x] 8. Tests: Write comprehensive Vitest test suite in tests/customer_measurements_e2e.test.ts

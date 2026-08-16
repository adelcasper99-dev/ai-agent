# Research Findings — Batch 3 Hardening (Findings #6, #7, #8, #10)

## 1. Finding #6: Non-Null `tenantId` Constraint in Prisma & SQLite
- **Current State:** Models `Sale`, `Purchase`, `Expense`, `SupplierPayment`, `CustomerLedgerEntry`, `JournalEntry`, `Supplier`, `Customer`, `Appointment` have `tenantId String?` in `schema.prisma`.
- **Vulnerability:** While `prisma-tenant-extension.ts` injects tenantId, schema-level nullable definitions allow raw inserts or legacy paths to persist rows with `tenantId: null`, creating unowned ghost records.
- **Industry Standard:** Multi-tenant databases MUST enforce NOT NULL constraints on tenant identifier columns across all tenant-scoped tables.
- **Prisma & SQLite Implementation:**
  - Update `schema.prisma`: change `tenantId String?` -> `tenantId String` on all financial and tenant-scoped entities.
  - Run `npx prisma db push` to synchronize table schemas.
  - Ensure all Prisma relations (`tenant Tenant @relation(...)`) are non-optional where appropriate.

## 2. Finding #7: Database Field Encryption (AES-256-GCM Envelope)
- **Current State:** `ApiKeyPool.keyString` and sensitive keys in `Setting` table (e.g. `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `LIVEKIT_API_SECRET`) are stored as plain text.
- **Security Requirement:** Encrypt sensitive secrets at rest using NIST-approved symmetric cipher (AES-256-GCM).
- **Architecture:**
  - Key Derivation: PBKDF2 or SHA-256 derivation from `INTERNAL_SERVICE_SECRET` or `JWT_SECRET`.
  - Format: `enc:v1:<ivHex>:<tagHex>:<ciphertextHex>`
  - Backwards Compatibility: If a string does NOT start with `enc:v1:`, return plaintext as-is. This enables zero-downtime, non-destructive migration.
  - Masking: Provide `maskSecret(str)` for administrative UI views (e.g. `AIzaSy...Ab12`).

## 3. Finding #10: Dynamic Salt & Peppered PIN Hashing
- **Current State:** `lib/session.ts` and `lib/auth.ts` define `hashPin(pin: string, salt: string = 'casper-salt')` which defaults to static `'casper-salt'`.
- **Security Standard:** PINs must be hashed with unique per-entity salts and server-side peppers to prevent pre-computed rainbow table attacks against low-entropy numeric PINs.
- **Implementation:**
  - Standardize `hashPin(pin: string, salt: string)`: Require explicit unique salt (e.g., customer UUID) or generate a cryptographic random salt formatted as `salt$hash`.
  - Mix with `JWT_SECRET` or `INTERNAL_SERVICE_SECRET` as server pepper.

## 4. Finding #8: Standalone Subscription Expiry Cron Process
- **Current State:** `enforceSubscriptionExpiry()` only fires lazily inside `app/api/health/voice/route.ts` upon external health pings.
- **Requirement:** Standalone cron job executing hourly to transition past-due subscriptions and trigger Telegram notifications.
- **Implementation:**
  - Script: `casper-voice-web/scripts/cron-subscription-expiry.ts`.
  - PM2 configuration: Registered in `ecosystem.config.js` or cron scheduler.

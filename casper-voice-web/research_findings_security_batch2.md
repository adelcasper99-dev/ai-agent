# Research Findings — Security Hardening Batch 2 (Findings #3, #4, #5)

**Date:** 2026-08-16  
**Task:** Fix XFF spoofing + Session expiry/revocation + Timing-safe compare

---

## Finding #3 — XFF Spoofing (10-minute fix)

### nginx.conf reality (empirically verified)
```nginx
proxy_set_header X-Real-IP $remote_addr;           # ← set from $remote_addr (attacker cannot spoof)
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;  # ← appends, not replaces
```
nginx already sets `X-Real-IP` from `$remote_addr` in ALL location blocks. The fix is **code-only** — no nginx change needed.

### Current broken code
```ts
// lib/rate-limit.ts — getClientIp()
const forwarded = req.headers.get('x-forwarded-for');
if (forwarded) return forwarded.split(',')[0].trim(); // ← attacker-controlled first hop
return req.headers.get('x-real-ip') ?? '127.0.0.1'; // ← correct but unreachable
```

### Fix: Invert the priority
```ts
// Check x-real-ip first (nginx sets from $remote_addr — not attacker-controllable)
const realIp = req.headers.get('x-real-ip');
if (realIp) return realIp;
// Fallback: last hop of x-forwarded-for (still potentially spoofable but at least it's the real IP)
const forwarded = req.headers.get('x-forwarded-for');
if (forwarded) return forwarded.split(',').at(-1)!.trim(); // last = nginx-appended real IP
return '127.0.0.1';
```

---

## Finding #4 — Session Tokens Never Expire

### Architecture constraint
- `lib/session.ts` has **zero Prisma imports** (by design — circular dep prevention)
- `lib/auth.ts` is a pure re-export passthrough — also no Prisma
- Therefore: jti DB blacklist check CANNOT go in `session.ts`

### Chosen pattern
**Short-term:** Add `jti + iat + exp` to all signed payloads (pure `session.ts` change — no DB needed)
**Revocation:** New `lib/session-store.ts` — Prisma-aware module for blacklist operations
**New DB table:** `RevokedSession` in `schema.prisma`

### Token format change

```ts
// BEFORE (all 3 session types):
// Tenant:   `${tenantId}.${signature}`         ← no expiry, deterministic
// Admin:    `${role}.${signature}`              ← no expiry, identical every login
// Customer: `${customerId}.${signature}`        ← no expiry, identical every login

// AFTER:
// All:      `${jti}.${payload_b64}.${signature}` where payload = { sub, role/id, iat, exp }
```

### Lifetimes (from Stage 0a decision)
- Admin: 8h
- Tenant: 24h  
- Customer: 30d (refresh token pattern for Customer — issue a short-lived token + refresh token)

### Callers that sign (must be updated)
- `app/api/auth/login/route.ts` → `signTenantSession` + `signAdminSession`
- `app/api/portal/[...]/route.ts` → `signCustomerSession`
- `app/api/magic-link/route.ts` → `signCustomerSession`

### Callers that verify (must check expiry + blacklist)
- Multiple `app/api/**` routes → `verifyAdminSession`, `verifyTenantSession`, `verifyCustomerSession`
- `lib/prisma-tenant-extension.ts` → `verifyTenantSession` (already updated last pipeline)

---

## Finding #5 — Non-Timing-Safe Signature Compare

### Affected functions in `session.ts`
```ts
// verifyTenantSession   → `signature === expectedSignature`  ← plain compare
// verifyAdminSession    → `signature === expectedSignature`  ← plain compare
// verifyCustomerSession → `signature === expectedSignature`  ← plain compare
// verifyMagicLink       → `signature === expectedSignature`  ← plain compare (new finding)
// verifyPin             → crypto.timingSafeEqual()           ✅ already correct
```

### Fix: apply `timingSafeEqual` pattern
```ts
// After computing both hex strings:
const a = Buffer.from(signature, 'hex');
const b = Buffer.from(expectedSignature, 'hex');
if (a.length !== b.length) return null; // length oracle guard
if (!crypto.timingSafeEqual(a, b)) return null;
```

The hex output of HMAC-SHA256 is always 64 chars — length check is technically redundant but costs nothing and future-proofs algorithm changes.

---

## Architecture Decision: Token Format

### New payload structure (Base64 encoded)
```ts
interface SessionPayload {
  sub: string;      // tenantId / customerId / role
  type: 'tenant' | 'admin' | 'customer';
  jti: string;      // UUID v4 — used for blacklisting
  iat: number;      // Unix seconds
  exp: number;      // Unix seconds
}
```

### New token wire format
```
<jti>.<base64_payload>.<hmac_signature>
```
- Compatible with existing cookie storage (HttpOnly cookies)
- `verifyXxx` functions return null if expired (before hitting blacklist DB)
- Blacklist check only needed if signature is valid (avoids unnecessary DB queries on invalid tokens)

### session.ts constraint preserved
- `session.ts` handles signing/expiry verification (pure crypto — no Prisma)
- `session-store.ts` handles blacklist (Prisma-aware)
- API route verify flow: `verifyXxx()` → if valid but expired → early return null; if valid and not expired → check `session-store.isRevoked(jti)`

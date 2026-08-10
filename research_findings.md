# External Best-Practice Research Report
`Casper Voice Web Audit Remediation` · `2026-08-11`

---

## 1. Web Crypto API in Next.js Edge vs Node.js Runtimes

### Industry Standard:
- **Node.js**: `crypto.createHmac('sha256', secret).update(data).digest('hex')` is zero-overhead synchronous execution.
- **Edge Runtime (Vercel / Cloudflare)**: Node `crypto` standard library may be absent or polyfilled. Standard Web Crypto API (`crypto.subtle`) is mandatory for FIPS-compliant cryptographic signatures.
- **Key Pattern**: Dual-path execution — test for native Node.js `crypto.createHmac`, fallback to `crypto.subtle.importKey` + `crypto.subtle.sign`.

### Key Code Pattern:
```ts
async function computeHmacHex(data: string): Promise<string> {
  const secret = getJwtSecret();
  try {
    const nodeCrypto = require('crypto');
    return nodeCrypto.createHmac('sha256', secret).update(data).digest('hex');
  } catch {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(data));
    return Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
```

---

## 2. Prisma ORM Decimal Handling in SQLite

### Best Practices:
- SQLite does not native decimal types (uses `REAL` IEEE-754 or `TEXT` strings).
- Prisma `@db.Decimal(18, 4)` stores monetary numbers as `TEXT` in SQLite database files, completely avoiding IEEE-754 floating-point drift.
- `Decimal.js` instance is returned by Prisma Client for all `Decimal` model fields.
- **Financial Guardrails**: Never perform `+`, `-`, `*`, `/` directly on JS floats for monetary operations. Always instantiate `new Decimal(field)` or use Decimal methods (`.plus()`, `.minus()`, `.mul()`, `.div()`).

---

## 3. Next.js App Router Auth Verification Patterns

### Best Practices:
- All administrative API routes MUST check session validity via HMAC signature verification before parsing or acting on request bodies.
- Never rely on cookie presence (`Boolean(cookie)`). Always verify signature validity via `verifyAdminSession(cookie)`.
- Fallbacks to internal authentication headers (`x-admin-key` or `INTERNAL_SERVICE_SECRET`) MUST perform exact timing-safe comparisons or verified secret matches.

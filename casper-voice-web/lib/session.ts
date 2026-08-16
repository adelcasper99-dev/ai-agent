/**
 * lib/session.ts
 *
 * Isolated session token utilities — zero Prisma imports.
 * Cross-runtime safe (Node.js & Edge Runtime compatible).
 *
 * Security Guarantees:
 * 1. Cryptographic Expiry: Tokens expire automatically based on payload timestamp.
 *    - Admin: 8 hours
 *    - Tenant: 24 hours
 *    - Customer: 30 days
 * 2. Revocation IDs (JTI): Unique UUID embedded in every token for selective blacklist support.
 * 3. Timing-Safe Comparisons: All signature checks use crypto.timingSafeEqual to prevent side-channel timing attacks.
 */

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      '[session.ts] JWT_SECRET environment variable is not set. Cannot sign or verify sessions.'
    );
  }
  return secret;
}

function generateJti(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');
    if (crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
      mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
  }
}

async function computeHmacHex(data: string): Promise<string> {
  const secret = getJwtSecret();
  // Dynamic require prevents top-level Edge Runtime static import bundler warnings
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  } catch {
    // Web Crypto API fallback for Edge runtime (FIPS-grade HMAC-SHA256)
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
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

export interface SessionDetails {
  sub: string;
  type: 'tenant' | 'admin' | 'customer';
  jti: string;
  expiresAt: Date;
}

// ── Tenant Session ─────────────────────────────────────────────────────────

/**
 * Signs a tenantId into a tamper-proof expiring token.
 * Default lifetime: 24 hours.
 * Token wire format: `${tenantId}.${jti}.${expiresAt}.${signature}`
 */
export async function signTenantSession(
  tenantId: string,
  expiresInHours: number = 24
): Promise<string> {
  const jti = generateJti();
  const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;
  const payload = `tenant:${tenantId}.${jti}.${expiresAt}`;
  const signature = await computeHmacHex(payload);
  return `${tenantId}.${jti}.${expiresAt}.${signature}`;
}

/**
 * Verifies tenant session token: validates signature, checks expiration, and returns tenantId.
 */
export async function verifyTenantSession(token: string): Promise<string | null> {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;

  const [tenantId, jti, expiresAtStr, signature] = parts;
  if (!tenantId || !jti || !expiresAtStr || !signature) return null;

  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return null; // Expired or invalid timestamp
  }

  const payload = `tenant:${tenantId}.${jti}.${expiresAtStr}`;
  const expectedSignature = await computeHmacHex(payload);
  return timingSafeEqualHex(signature, expectedSignature) ? tenantId : null;
}

/**
 * Alias for raw string return (same as verifyTenantSession).
 */
export const verifyTenantSessionRaw = verifyTenantSession;

// ── Admin Session ──────────────────────────────────────────────────────────

/**
 * Signs an admin role into a tamper-proof expiring token.
 * Default lifetime: 8 hours.
 * Token wire format: `${role}.${jti}.${expiresAt}.${signature}`
 */
export async function signAdminSession(
  role: string = 'admin',
  expiresInHours: number = 8
): Promise<string> {
  const jti = generateJti();
  const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;
  const payload = `admin:${role}.${jti}.${expiresAt}`;
  const signature = await computeHmacHex(payload);
  return `${role}.${jti}.${expiresAt}.${signature}`;
}

/**
 * Verifies admin session token: validates signature, checks expiration, and returns boolean.
 */
export async function verifyAdminSession(token: string): Promise<boolean> {
  if (!token || !token.includes('.')) return false;
  const parts = token.split('.');
  if (parts.length !== 4) return false;

  const [role, jti, expiresAtStr, signature] = parts;
  if (!role || !jti || !expiresAtStr || !signature) return false;

  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return false; // Expired or invalid timestamp
  }

  const payload = `admin:${role}.${jti}.${expiresAtStr}`;
  const expectedSignature = await computeHmacHex(payload);
  return timingSafeEqualHex(signature, expectedSignature);
}

/**
 * Alias for raw role string return.
 */
export async function verifyAdminSessionRaw(token: string): Promise<string | null> {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;

  const [role, jti, expiresAtStr, signature] = parts;
  if (!role || !jti || !expiresAtStr || !signature) return null;

  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return null;

  const payload = `admin:${role}.${jti}.${expiresAtStr}`;
  const expectedSignature = await computeHmacHex(payload);
  return timingSafeEqualHex(signature, expectedSignature) ? role : null;
}

// ── Customer Session ───────────────────────────────────────────────────────

/**
 * Signs a customerId into a tamper-proof expiring token.
 * Default lifetime: 30 days.
 * Token wire format: `${customerId}.${jti}.${expiresAt}.${signature}`
 */
export async function signCustomerSession(
  customerId: string,
  expiresInDays: number = 30
): Promise<string> {
  const jti = generateJti();
  const expiresAt = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  const payload = `customer:${customerId}.${jti}.${expiresAt}`;
  const signature = await computeHmacHex(payload);
  return `${customerId}.${jti}.${expiresAt}.${signature}`;
}

/**
 * Verifies customer session token: validates signature, checks expiration, and returns customerId.
 */
export async function verifyCustomerSession(token: string): Promise<string | null> {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;

  const [customerId, jti, expiresAtStr, signature] = parts;
  if (!customerId || !jti || !expiresAtStr || !signature) return null;

  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return null; // Expired or invalid timestamp
  }

  const payload = `customer:${customerId}.${jti}.${expiresAtStr}`;
  const expectedSignature = await computeHmacHex(payload);
  return timingSafeEqualHex(signature, expectedSignature) ? customerId : null;
}

export const verifyCustomerSessionRaw = verifyCustomerSession;

// ── Session Inspection / Blacklist Details ─────────────────────────────────

/**
 * Extracts and verifies full session metadata (JTI, expiration, subject)
 * for selective revocation / blacklist logging without touching the database.
 */
export async function extractSessionDetails(token: string): Promise<SessionDetails | null> {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;

  const [sub, jti, expiresAtStr, signature] = parts;
  if (!sub || !jti || !expiresAtStr || !signature) return null;

  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return null;

  // Verify against all possible session types
  const types: Array<'tenant' | 'admin' | 'customer'> = ['tenant', 'admin', 'customer'];
  for (const type of types) {
    const payload = `${type}:${sub}.${jti}.${expiresAtStr}`;
    const expectedSignature = await computeHmacHex(payload);
    if (timingSafeEqualHex(signature, expectedSignature)) {
      return {
        sub,
        type,
        jti,
        expiresAt: new Date(expiresAt),
      };
    }
  }

  return null;
}

// ── PIN & Magic Link Utilities ─────────────────────────────────────────────

/**
 * Hashes a numeric/alphanumeric PIN with a customer-specific or system salt.
 */
export async function hashPin(pin: string, salt: string = 'casper-salt'): Promise<string> {
  return await computeHmacHex(`pin:${salt}:${pin}`);
}

/**
 * Verifies if the provided PIN matches the stored hash using timing-safe comparison.
 */
export async function verifyPin(
  pin: string,
  storedHash: string,
  salt: string = 'casper-salt'
): Promise<boolean> {
  const computed = await hashPin(pin, salt);
  return timingSafeEqualHex(computed, storedHash);
}

/**
 * Signs an expiring Magic Link for Telegram / Instant Web Login.
 * Defaults to 15 minutes expiration.
 */
export async function signMagicLink(
  customerId: string,
  expiresInMinutes: number = 15
): Promise<string> {
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
  const payload = `${customerId}.${expiresAt}`;
  const signature = await computeHmacHex(`magic:${payload}`);
  return `${payload}.${signature}`;
}

/**
 * Verifies a Magic Link token using timing-safe comparison. Returns customerId if valid and not expired.
 */
export async function verifyMagicLink(token: string): Promise<string | null> {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [customerId, expiresAtStr, signature] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return null; // Expired or invalid timestamp
  }

  const payload = `${customerId}.${expiresAtStr}`;
  const expectedSignature = await computeHmacHex(`magic:${payload}`);
  return timingSafeEqualHex(signature, expectedSignature) ? customerId : null;
}

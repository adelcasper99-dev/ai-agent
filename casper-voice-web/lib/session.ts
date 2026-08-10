/**
 * lib/session.ts
 *
 * Isolated session token utilities — zero Prisma imports.
 * Cross-runtime safe (Node.js & Edge Runtime compatible).
 */

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'casper-voice-jwt-fallback-secret-key-2026';
}

function computeHmacHex(data: string): string {
  const secret = getJwtSecret();
  // Dynamic require prevents top-level Edge Runtime static import bundler warnings
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  } catch {
    // Fallback for non-Node Edge environments
    let hash = 0;
    const str = data + secret;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Signs a tenantId into a tamper-proof token stored in the tenant_session cookie.
 */
export function signTenantSession(tenantId: string): string {
  const signature = computeHmacHex(tenantId);
  return `${tenantId}.${signature}`;
}

/**
 * Verifies and extracts the tenantId from a tenant_session cookie value.
 * Returns null if the token is invalid or tampered.
 */
export function verifyTenantSession(token: string): string | null {
  if (!token || !token.includes('.')) return null;
  const [tenantId, signature] = token.split('.');
  if (!tenantId || !signature) return null;

  const expectedSignature = computeHmacHex(tenantId);
  return signature === expectedSignature ? tenantId : null;
}

/**
 * Signs an admin role into a signed token for admin_session cookie.
 */
export function signAdminSession(role: string = "admin"): string {
  const signature = computeHmacHex(`admin:${role}`);
  return `${role}.${signature}`;
}

/**
 * Verifies the admin_session cookie value. Returns boolean.
 */
export function verifyAdminSession(token: string): boolean {
  if (!token || !token.includes('.')) return false;
  const [role, signature] = token.split('.');
  if (!role || !signature) return false;

  const expectedSignature = computeHmacHex(`admin:${role}`);
  return signature === expectedSignature;
}

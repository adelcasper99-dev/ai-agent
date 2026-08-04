/**
 * lib/session.ts
 *
 * Isolated session token utilities — zero Prisma imports.
 * Extracted from auth.ts to break the potential circular dependency:
 *   prisma.ts → prisma-tenant-extension.ts → auth.ts → (if auth ever imports prisma) → prisma.ts
 *
 * Safe to require() inside Prisma extensions and middleware.
 */

import crypto from 'crypto';

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'casper-voice-jwt-fallback-secret-key-2026';
}

/**
 * Signs a tenantId into a tamper-proof HMAC token stored in the tenant_session cookie.
 */
export function signTenantSession(tenantId: string): string {
  const secret = getJwtSecret();
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(tenantId);
  const signature = hmac.digest('hex');
  return `${tenantId}.${signature}`;
}

/**
 * Verifies and extracts the tenantId from a tenant_session cookie value.
 * Returns null if the token is invalid or tampered.
 */
export function verifyTenantSession(token: string): string | null {
  if (!token || !token.includes('.')) return null;
  const secret = getJwtSecret();
  const [tenantId, signature] = token.split('.');
  if (!tenantId || !signature) return null;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(tenantId);
  const expectedSignature = hmac.digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) return null;

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer) ? tenantId : null;
}

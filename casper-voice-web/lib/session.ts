/**
 * lib/session.ts
 *
 * Isolated session token utilities — zero Prisma imports.
 * Cross-runtime safe (Node.js & Edge Runtime compatible).
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

/**
 * Signs a tenantId into a tamper-proof token stored in the tenant_session cookie.
 */
export async function signTenantSession(tenantId: string): Promise<string> {
  const signature = await computeHmacHex(tenantId);
  return `${tenantId}.${signature}`;
}

/**
 * Verifies and extracts the tenantId from a tenant_session cookie value.
 * Returns null if the token is invalid or tampered.
 */
export async function verifyTenantSession(token: string): Promise<string | null> {
  if (!token || !token.includes('.')) return null;
  const [tenantId, signature] = token.split('.');
  if (!tenantId || !signature) return null;

  const expectedSignature = await computeHmacHex(tenantId);
  return signature === expectedSignature ? tenantId : null;
}

/**
 * Signs an admin role into a signed token for admin_session cookie.
 */
export async function signAdminSession(role: string = "admin"): Promise<string> {
  const signature = await computeHmacHex(`admin:${role}`);
  return `${role}.${signature}`;
}

/**
 * Verifies the admin_session cookie value. Returns boolean.
 */
export async function verifyAdminSession(token: string): Promise<boolean> {
  if (!token || !token.includes('.')) return false;
  const [role, signature] = token.split('.');
  if (!role || !signature) return false;

  const expectedSignature = await computeHmacHex(`admin:${role}`);
  return signature === expectedSignature;
}

/**
 * Signs a customerId into a signed token for customer_session cookie.
 */
export async function signCustomerSession(customerId: string): Promise<string> {
  const signature = await computeHmacHex(`customer:${customerId}`);
  return `${customerId}.${signature}`;
}

/**
 * Verifies the customer_session cookie value and returns customerId.
 */
export async function verifyCustomerSession(token: string): Promise<string | null> {
  if (!token || !token.includes('.')) return null;
  const [customerId, signature] = token.split('.');
  if (!customerId || !signature) return null;

  const expectedSignature = await computeHmacHex(`customer:${customerId}`);
  return signature === expectedSignature ? customerId : null;
}


import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  signTenantSession,
  verifyTenantSession,
  signAdminSession,
  verifyAdminSession,
  signCustomerSession,
  verifyCustomerSession,
  hashPin,
  verifyPin,
  signMagicLink,
  verifyMagicLink,
  extractSessionDetails,
} from '../lib/session';
import { getClientIp } from '../lib/rate-limit';
import { revokeSession, isSessionRevoked, cleanupExpiredRevokedSessions } from '../lib/session-store';
import { prismaSystem } from '../lib/prisma';

describe('Finding #3: XFF Spoofing & Client IP Resolution', () => {
  it('1. Returns X-Real-IP when present, ignoring spoofed X-Forwarded-For', () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      headers: {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        'x-real-ip': '198.51.100.42',
      },
    });
    const ip = getClientIp(req);
    expect(ip).toBe('198.51.100.42');
  });

  it('2. When X-Real-IP is absent, extracts the LAST hop from X-Forwarded-For', () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      headers: {
        'x-forwarded-for': '1.2.3.4, 203.0.113.195',
      },
    });
    const ip = getClientIp(req);
    expect(ip).toBe('203.0.113.195');
  });

  it('3. Falls back to 127.0.0.1 when no IP headers exist', () => {
    const req = new Request('http://localhost:3000/api/auth/login');
    const ip = getClientIp(req);
    expect(ip).toBe('127.0.0.1');
  });
});

describe('Finding #4: Session Token Expiry & Structure', () => {
  const TENANT_ID = 'test-tenant-sec-01';

  it('1. Tenant session token contains 4 parts [sub, jti, exp, signature]', async () => {
    const token = await signTenantSession(TENANT_ID, 24);
    const parts = token.split('.');
    expect(parts.length).toBe(4);
    expect(parts[0]).toBe(TENANT_ID);
    // UUID v4 format check
    expect(parts[1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    // Expiration timestamp is in the future
    const exp = parseInt(parts[2], 10);
    expect(exp).toBeGreaterThan(Date.now());
  });

  it('2. Valid tenant session verifies successfully', async () => {
    const token = await signTenantSession(TENANT_ID, 24);
    const verified = await verifyTenantSession(token);
    expect(verified).toBe(TENANT_ID);
  });

  it('3. Expired tenant session returns null immediately', async () => {
    // Negative expiration duration creates an already-expired token
    const expiredToken = await signTenantSession(TENANT_ID, -1);
    const verified = await verifyTenantSession(expiredToken);
    expect(verified).toBeNull();
  });

  it('4. Admin session verifies and enforces expiration', async () => {
    const adminToken = await signAdminSession('admin', 8);
    const isValid = await verifyAdminSession(adminToken);
    expect(isValid).toBe(true);

    const expiredAdmin = await signAdminSession('admin', -1);
    const isExpiredValid = await verifyAdminSession(expiredAdmin);
    expect(isExpiredValid).toBe(false);
  });

  it('5. Customer session verifies and enforces expiration', async () => {
    const customerToken = await signCustomerSession('cust-789', 30);
    const verifiedId = await verifyCustomerSession(customerToken);
    expect(verifiedId).toBe('cust-789');

    const expiredCust = await signCustomerSession('cust-789', -1);
    const isExpiredValid = await verifyCustomerSession(expiredCust);
    expect(isExpiredValid).toBeNull();
  });
});

describe('Finding #5: Timing-Safe Verification & Anti-Tampering', () => {
  it('1. Tampered signature on tenant token returns null', async () => {
    const token = await signTenantSession('tenant-999');
    const parts = token.split('.');
    parts[3] = parts[3].slice(0, -4) + 'ffff'; // Tamper signature
    const tampered = parts.join('.');

    const result = await verifyTenantSession(tampered);
    expect(result).toBeNull();
  });

  it('2. Tampered payload with original signature returns null', async () => {
    const token = await signTenantSession('tenant-999');
    const parts = token.split('.');
    parts[0] = 'tenant-hacked'; // Change tenant ID
    const tampered = parts.join('.');

    const result = await verifyTenantSession(tampered);
    expect(result).toBeNull();
  });

  it('3. PIN verification timing-safe check', async () => {
    const pin = '1234';
    const hash = await hashPin(pin, 'salt-123');
    expect(await verifyPin(pin, hash, 'salt-123')).toBe(true);
    expect(await verifyPin('9999', hash, 'salt-123')).toBe(false);
    expect(await verifyPin(pin, hash, 'wrong-salt')).toBe(false);
  });

  it('4. Magic link verification timing-safe check & expiration', async () => {
    const magic = await signMagicLink('cust-123', 15);
    expect(await verifyMagicLink(magic)).toBe('cust-123');

    // Tampered magic link
    expect(await verifyMagicLink(magic + 'evil')).toBeNull();

    // Expired magic link
    const expiredMagic = await signMagicLink('cust-123', -5);
    expect(await verifyMagicLink(expiredMagic)).toBeNull();
  });
});

describe('Session Revocation & Blacklist Storage', () => {
  it('1. extractSessionDetails extracts JTI and expiration accurately', async () => {
    const token = await signTenantSession('tenant-rev-test', 24);
    const details = await extractSessionDetails(token);
    expect(details).not.toBeNull();
    expect(details?.sub).toBe('tenant-rev-test');
    expect(details?.type).toBe('tenant');
    expect(details?.jti).toBeDefined();
    expect(details?.expiresAt).toBeInstanceOf(Date);
  });

  it('2. Revoked session is recognized by isSessionRevoked', async () => {
    const token = await signTenantSession('tenant-rev-test', 24);
    const details = await extractSessionDetails(token);
    expect(details).not.toBeNull();

    const jti = details!.jti;
    expect(await isSessionRevoked(jti)).toBe(false);

    await revokeSession(jti, details!.expiresAt);
    expect(await isSessionRevoked(jti)).toBe(true);
  });

  it('3. cleanupExpiredRevokedSessions prunes past tokens', async () => {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60);
    const oldJti = 'old-expired-jti-' + Math.random().toString(36).substring(7);
    await revokeSession(oldJti, pastDate);

    const pruned = await cleanupExpiredRevokedSessions();
    expect(pruned).toBeGreaterThanOrEqual(1);
    expect(await isSessionRevoked(oldJti)).toBe(false);
  });

  afterAll(async () => {
    await prismaSystem.$disconnect();
  });
});

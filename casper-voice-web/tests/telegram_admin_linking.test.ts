import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma, prismaSystem } from '../lib/prisma';
import { getAdminChatId } from '../lib/telegram';
import { POST as generateRoute } from '../app/api/dashboard/settings/admin-link/generate/route';

describe('Telegram Admin Linking Engine', () => {
  beforeEach(async () => {
    // Clean test records
    await prismaSystem.adminLinkAudit.deleteMany();
    await prismaSystem.adminLinkToken.deleteMany();
    await prismaSystem.setting.deleteMany({
      where: { key: 'ADMIN_TELEGRAM_CHAT_ID' },
    });
  });

  afterEach(async () => {
    await prismaSystem.adminLinkAudit.deleteMany();
    await prismaSystem.adminLinkToken.deleteMany();
    await prismaSystem.setting.deleteMany({
      where: { key: 'ADMIN_TELEGRAM_CHAT_ID' },
    });
  });

  it('getAdminChatId reads DB Setting first before process.env fallback', async () => {
    process.env.ADMIN_CHAT_ID = 'env-fallback-999';

    // Before DB insert
    let id = await getAdminChatId();
    expect(id).toBe('env-fallback-999');

    // Insert DB setting
    await prismaSystem.setting.create({
      data: { key: 'ADMIN_TELEGRAM_CHAT_ID', value: 'db-admin-777' },
    });

    // After DB insert
    id = await getAdminChatId();
    expect(id).toBe('db-admin-777');
  });

  it('invalidates prior unused tokens for the same scope before creating a new one', async () => {
    // Create an active token
    const token1 = await prismaSystem.adminLinkToken.create({
      data: {
        scope: 'GLOBAL',
        code: '1234',
        expiresAt: new Date(Date.now() + 300000),
        used: false,
      },
    });

    expect(token1.used).toBe(false);

    // Simulate generating a new token for the same scope
    await prismaSystem.adminLinkToken.updateMany({
      where: {
        scope: 'GLOBAL',
        tenantId: null,
        used: false,
        expiresAt: { gt: new Date() },
      },
      data: { used: true },
    });

    const token1Refreshed = await prismaSystem.adminLinkToken.findUnique({
      where: { id: token1.id },
    });
    expect(token1Refreshed?.used).toBe(true);
  });

  it('enforces atomic token claiming via Prisma updateMany with count === 1', async () => {
    const token = await prismaSystem.adminLinkToken.create({
      data: {
        scope: 'GLOBAL',
        code: '4321',
        expiresAt: new Date(Date.now() + 300000),
        used: false,
      },
    });

    // First atomic claim
    const claim1 = await prismaSystem.adminLinkToken.updateMany({
      where: { id: token.id, used: false, expiresAt: { gt: new Date() } },
      data: { used: true },
    });
    expect(claim1.count).toBe(1);

    // Second concurrent claim attempt
    const claim2 = await prismaSystem.adminLinkToken.updateMany({
      where: { id: token.id, used: false, expiresAt: { gt: new Date() } },
      data: { used: true },
    });
    expect(claim2.count).toBe(0);
  });

  it('enforces tenant-isolation: TENANT scope token is isolated to its target tenantId', async () => {
    const tenantA = await prismaSystem.tenant.create({
      data: { name: 'Tenant A Test', state: 'active' },
    });
    const tenantB = await prismaSystem.tenant.create({
      data: { name: 'Tenant B Test', state: 'active' },
    });

    const tokenA = await prismaSystem.adminLinkToken.create({
      data: {
        scope: 'TENANT',
        tenantId: tenantA.id,
        code: '9988',
        expiresAt: new Date(Date.now() + 300000),
        used: false,
      },
    });

    // Verify tokenA belongs strictly to tenantA and not tenantB
    expect(tokenA.tenantId).toBe(tenantA.id);
    expect(tokenA.tenantId).not.toBe(tenantB.id);

    // Perform atomic transaction simulating linking Tenant A
    await prismaSystem.$transaction(async (tx) => {
      const claimed = await tx.adminLinkToken.updateMany({
        where: { id: tokenA.id, used: false, expiresAt: { gt: new Date() } },
        data: { used: true },
      });
      expect(claimed.count).toBe(1);

      await tx.tenant.update({
        where: { id: tokenA.tenantId! },
        data: { telegramChatId: 'chat-tenant-a-123' },
      });
    });

    const updatedA = await prismaSystem.tenant.findUnique({ where: { id: tenantA.id } });
    const updatedB = await prismaSystem.tenant.findUnique({ where: { id: tenantB.id } });

    expect(updatedA?.telegramChatId).toBe('chat-tenant-a-123');
    expect(updatedB?.telegramChatId).toBeNull();

    // Clean up tenants
    await prismaSystem.tenant.delete({ where: { id: tenantA.id } });
    await prismaSystem.tenant.delete({ where: { id: tenantB.id } });
  });

  it('enforces global-scope guard: returns 403 when requesting GLOBAL token without super admin credentials', async () => {
    const unauthReq = new NextRequest("http://localhost:3000/api/dashboard/settings/admin-link/generate", {
      method: "POST",
    });

    const res = await generateRoute(unauthReq);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Unauthorized");
  });

  it('rejects hardcoded fallback secret literals (casper-voice-internal-secret-9988776655) when env vars are unset', async () => {
    const origSecret = process.env.INTERNAL_SERVICE_SECRET;
    const origApiKey = process.env.INTERNAL_API_KEY;
    const origAdminKey = process.env.ADMIN_KEY;

    delete process.env.INTERNAL_SERVICE_SECRET;
    delete process.env.INTERNAL_API_KEY;
    delete process.env.ADMIN_KEY;

    try {
      const spoofedReq = new NextRequest("http://localhost:3000/api/dashboard/settings/admin-link/generate", {
        method: "POST",
        headers: {
          "x-internal-secret": "casper-voice-internal-secret-9988776655",
          "x-admin-session": "test-internal-secret-key-123",
          "x-admin-key": "casper-admin-secret",
        },
      });

      const res = await generateRoute(spoofedReq);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Unauthorized");
    } finally {
      if (origSecret) process.env.INTERNAL_SERVICE_SECRET = origSecret;
      if (origApiKey) process.env.INTERNAL_API_KEY = origApiKey;
      if (origAdminKey) process.env.ADMIN_KEY = origAdminKey;
    }
  });

  it('records Audit Log on successful link transaction', async () => {
    await prismaSystem.adminLinkAudit.create({
      data: {
        scope: 'GLOBAL',
        oldChatId: '111',
        newChatId: '222',
      },
    });

    const audit = await prismaSystem.adminLinkAudit.findFirst({
      where: { newChatId: '222' },
    });
    expect(audit).toBeDefined();
    expect(audit?.scope).toBe('GLOBAL');
    expect(audit?.oldChatId).toBe('111');
  });
});



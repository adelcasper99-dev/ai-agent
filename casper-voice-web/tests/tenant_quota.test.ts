/**
 * tests/tenant_quota.test.ts — Automated Unit & Integration Tests for Tenant LLM Quota Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';
import { checkAndIncrementTenantLlmQuota, getCairoTodayDateString } from '../lib/tenant-quota';

describe('Tenant LLM Quota Engine', () => {
  const testTenantId = 'test_quota_tenant_999';

  beforeEach(async () => {
    // Clean up test tenant
    await (prisma as any).tenant.deleteMany({ where: { id: testTenantId } });

    // Seed test tenant
    await (prisma as any).tenant.create({
      data: {
        id: testTenantId,
        name: 'شركة الاختبار المحدودة',
        merchantName: 'تاجر الاختبار',
        phoneNumber: '+201099988877',
        state: 'active',
        telegramChatId: 'test_quota_chat_999',
        dailyLlmLimit: 5, // Set small limit for fast test verification
        dailyLlmUsage: 0,
        lastLlmReset: new Date(),
      },
    });
  });

  it('1. Correctly formats Cairo date string in YYYY-MM-DD', () => {
    const todayStr = getCairoTodayDateString();
    expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('2. Increments daily LLM usage atomically', async () => {
    const res1 = await checkAndIncrementTenantLlmQuota(testTenantId);
    expect(res1.allowed).toBe(true);
    expect(res1.usage).toBe(1);
    expect(res1.remaining).toBe(4);

    const res2 = await checkAndIncrementTenantLlmQuota(testTenantId);
    expect(res2.allowed).toBe(true);
    expect(res2.usage).toBe(2);
    expect(res2.remaining).toBe(3);
  });

  it('3. Blocks requests and triggers quota exhaustion when limit (5/5) is reached', async () => {
    // Simulate usage at limit (5)
    await (prisma as any).tenant.update({
      where: { id: testTenantId },
      data: { dailyLlmUsage: 5 },
    });

    const resExhausted = await checkAndIncrementTenantLlmQuota(testTenantId);
    expect(resExhausted.allowed).toBe(false);
    expect(resExhausted.remaining).toBe(0);
    expect(resExhausted.usage).toBe(5);
  });

  it('4. Resets usage automatically if lastLlmReset was yesterday', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await (prisma as any).tenant.update({
      where: { id: testTenantId },
      data: {
        dailyLlmUsage: 5,
        lastLlmReset: yesterday,
        alert100SentDate: '2026-01-01',
      },
    });

    const resAfterReset = await checkAndIncrementTenantLlmQuota(testTenantId);
    expect(resAfterReset.allowed).toBe(true);
    expect(resAfterReset.usage).toBe(1);
    expect(resAfterReset.remaining).toBe(4);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';
import {
  saveMerchantMemory,
  resolveMerchantMemories,
  extractAndPersistMemory
} from '../lib/merchant_memory';

describe('MerchantMemory System Safeguards & Resolution', () => {
  const testTenantId = 'test_tenant_mem_001';

  beforeEach(async () => {
    await prisma.merchantMemory.deleteMany({
      where: { tenantId: testTenantId }
    });
  });

  it('G1: Successfully saves and resolves explicit customer alias', async () => {
    const memory = await saveMerchantMemory(testTenantId, {
      category: 'customer_alias',
      key: 'أبو صلاح',
      value: 'أحمد محمد المانسترلي | customer_id=42',
      confidence: 1.0,
      source: 'explicit_statement'
    });

    expect(memory).not.toBeNull();
    expect(memory?.key).toBe('أبو صلاح');

    const resolved = await resolveMerchantMemories(testTenantId, 'سدد أبو صلاح 500 جنيه');
    expect(resolved).toHaveLength(1);
    expect(resolved[0].value).toContain('أحمد محمد المانسترلي');
  });

  it('G2: Rejects financial figures from memory storage (Financial Guardrail)', async () => {
    const memoryWithPrice = await saveMerchantMemory(testTenantId, {
      category: 'customer_alias',
      key: 'رصيد أبو صلاح',
      value: 'عليه مديونية 500 جنيه',
    });

    expect(memoryWithPrice).toBeNull();

    const memories = await prisma.merchantMemory.findMany({
      where: { tenantId: testTenantId }
    });
    expect(memories).toHaveLength(0);
  });

  it('G3: Asynchronously extracts explicit alias pattern "X ده Y"', async () => {
    await extractAndPersistMemory(testTenantId, 'أبو صلاح ده أحمد محمد');

    const resolved = await resolveMerchantMemories(testTenantId, 'أبو صلاح');
    expect(resolved).toHaveLength(1);
    expect(resolved[0].key).toBe('أبو صلاح');
    expect(resolved[0].value).toBe('أحمد محمد');
  });

  it('G4: Upserts memory clean update when merchant corrects alias', async () => {
    await saveMerchantMemory(testTenantId, {
      category: 'customer_alias',
      key: 'أبو صلاح',
      value: 'أحمد القديم'
    });

    await saveMerchantMemory(testTenantId, {
      category: 'customer_alias',
      key: 'أبو صلاح',
      value: 'محمد الجديد',
      source: 'confirmed_correction'
    });

    const resolved = await resolveMerchantMemories(testTenantId, 'أبو صلاح');
    expect(resolved).toHaveLength(1);
    expect(resolved[0].value).toBe('محمد الجديد');
  });
});

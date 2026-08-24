import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import Decimal from 'decimal.js';
import {
  resolveActiveTools,
  buildActivePrompt,
  executeTool,
  ALL_TOOLS
} from '../lib/telegram_llm';

describe('Customer Measurements & Caveman Telegram Architecture (E2E & Integration)', () => {
  const testTenantId = 'test_tenant_meas_123';
  const testCustomerName = 'محمد صادق';

  beforeEach(async () => {
    // Ensure test tenant exists in DB
    await prisma.tenant.upsert({
      where: { id: testTenantId },
      update: {},
      create: {
        id: testTenantId,
        name: 'شركة الأمل للألوميتال',
        merchantName: 'محمد أحمد',
        state: 'active'
      }
    });

    // Clean up measurements and quotations for clean state
    await prisma.customerMeasurement.deleteMany({
      where: { tenantId: testTenantId }
    }).catch(() => null);
    await prisma.quotation.deleteMany({
      where: { tenantId: testTenantId }
    }).catch(() => null);
  });

  it('1. Tool Routing: Resolves ALUMITAL cluster and save_customer_measurement on measurement text', () => {
    const query = 'سجل مقاس لمحمد صادق شباك 120 في 140 زجاج دبل عسلي';
    const resolution = resolveActiveTools(query);
    
    expect(resolution.activeClusters).toContain('ALUMITAL');
    const hasSaveTool = resolution.activeTools.some((t) => t.name === 'save_customer_measurement');
    expect(hasSaveTool).toBe(true);
  });

  it('2. Tool Routing: Resolves get_customer_measurements on query for customer measurements', () => {
    const query = 'مقاسات العميل محمد صادق كام؟';
    const resolution = resolveActiveTools(query);
    
    expect(resolution.activeClusters).toContain('ALUMITAL');
    const hasGetTool = resolution.activeTools.some((t) => t.name === 'get_customer_measurements');
    expect(hasGetTool).toBe(true);
  });

  it('3. Tool Routing: Resolves update and delete measurement tools on update/delete commands', () => {
    const updateQuery = 'عدل شباك 140 في 150 خليه 190 في 180 لمحمد صادق';
    const updateRes = resolveActiveTools(updateQuery);
    expect(updateRes.activeTools.some((t) => t.name === 'update_customer_measurement')).toBe(true);

    const deleteQuery = 'امسح باب الحمام من مقاسات محمد صادق';
    const deleteRes = resolveActiveTools(deleteQuery);
    expect(deleteRes.activeTools.some((t) => t.name === 'delete_customer_measurement')).toBe(true);
  });

  it('4. Caveman Prompt Integrity: buildActivePrompt includes strict Caveman Mode guidelines', () => {
    const prompt = buildActivePrompt(['ALUMITAL'], 'بشركة الأمل', '(ألوميتال ومطابخ)', '(9 ص إلى 10 م)');
    expect(prompt).toContain('Strict Caveman Mode');
    expect(prompt).toContain('الردود فائقة الإيجاز');
    expect(prompt).toContain('ممنوع منعاً باتاً الاعتذار');
    expect(prompt).toContain('save_customer_measurement');
    expect(prompt).toContain('get_customer_measurements');
  });

  it('5. Database Execution: save_customer_measurement saves single item with specs', async () => {
    const result = await executeTool(
      'save_customer_measurement',
      {
        customer_name: testCustomerName,
        item_type: 'شباك',
        width_cm: 120,
        height_cm: 140,
        material: 'قطاع جامبو',
        glass_type: 'دبل عسلي',
        accessories: 'سلك بليسيه'
      },
      testTenantId,
      'سجل مقاس لمحمد صادق'
    );

    expect(result.success).toBe(true);
    expect(result.resultText).toContain('محمد صادق');
    expect(result.resultText).toContain('120×140');

    // Verify DB
    const saved = await prisma.customerMeasurement.findFirst({
      where: { tenantId: testTenantId, customerName: testCustomerName }
    });
    expect(saved).not.toBeNull();
    expect(saved?.itemType).toBe('شباك');
    expect(Number(saved?.width_cm)).toBe(120);
    expect(Number(saved?.height_cm)).toBe(140);
    expect(saved?.glassType).toBe('دبل عسلي');
  });

  it('6. Multi-Item & Kitchen Specs: save_customer_measurement handles array of items', async () => {
    const result = await executeTool(
      'save_customer_measurement',
      {
        customer_name: testCustomerName,
        items: [
          { item_type: 'شباك', width_cm: 140, height_cm: 150, material: 'جامبو', glass_type: 'دبل عسلي' },
          { item_type: 'باب', width_cm: 90, height_cm: 210, accessories: 'مقبض إيطالي' },
          { item_type: 'مطبخ', width_cm: 300, depth_cm: 60, material: 'خشمونيوم', accessories: 'مفصلات باكم' }
        ]
      },
      testTenantId
    );

    expect(result.success).toBe(true);
    const count = await prisma.customerMeasurement.count({
      where: { tenantId: testTenantId, customerName: testCustomerName }
    });
    expect(count).toBe(3);
  });

  it('7. Retrieval: get_customer_measurements returns formatted list of active measurements', async () => {
    // Seed 2 items
    await prisma.customerMeasurement.createMany({
      data: [
        {
          tenantId: testTenantId,
          customerName: testCustomerName,
          itemType: 'شباك',
          width_cm: new Decimal(120),
          height_cm: new Decimal(140),
          material: 'جامبو'
        },
        {
          tenantId: testTenantId,
          customerName: testCustomerName,
          itemType: 'باب',
          width_cm: new Decimal(80),
          height_cm: new Decimal(210)
        }
      ]
    });

    const getRes = await executeTool(
      'get_customer_measurements',
      { customer_name: testCustomerName },
      testTenantId
    );

    expect(getRes.success).toBe(true);
    expect(getRes.resultText).toContain('محمد صادق');
    expect(getRes.resultText).toContain('120×140');
    expect(getRes.resultText).toContain('80×210');
  });

  it('8. Update & Delete Lifecycle: updates dimensions and soft-deletes item', async () => {
    const created = await prisma.customerMeasurement.create({
      data: {
        tenantId: testTenantId,
        customerName: testCustomerName,
        itemType: 'شباك',
        width_cm: new Decimal(140),
        height_cm: new Decimal(150)
      }
    });

    // Update
    const updateRes = await executeTool(
      'update_customer_measurement',
      {
        customer_name: testCustomerName,
        old_width_cm: 140,
        old_height_cm: 150,
        new_width_cm: 190,
        new_height_cm: 180
      },
      testTenantId
    );

    expect(updateRes.success).toBe(true);
    expect(updateRes.resultText).toContain('190×180');

    const updated = await prisma.customerMeasurement.findUnique({ where: { id: created.id } });
    expect(Number(updated?.width_cm)).toBe(190);
    expect(Number(updated?.height_cm)).toBe(180);

    // Delete
    const delRes = await executeTool(
      'delete_customer_measurement',
      {
        customer_name: testCustomerName,
        target_item_type: 'شباك'
      },
      testTenantId
    );

    expect(delRes.success).toBe(true);
    const deleted = await prisma.customerMeasurement.findUnique({ where: { id: created.id } });
    expect(deleted?.status).toBe('cancelled');
  });

  it('9. Quotation vs Measurement Synergy: calculate_alumital_quotation operates independently without conflict', async () => {
    const quoteRes = await executeTool(
      'calculate_alumital_quotation',
      {
        customer_ref: testCustomerName,
        width_cm: 120,
        height_cm: 140,
        price_per_meter: 1500
      },
      testTenantId
    );

    expect(quoteRes.success).toBe(true);
    expect(quoteRes.resultText).toContain('مقايسة ألوميتال مبدئية');
    expect(quoteRes.resultText).toContain('المبلغ الإجمالي');

    const quoteCount = await prisma.quotation.count({
      where: { tenantId: testTenantId }
    });
    expect(quoteCount).toBe(1);
  });
});

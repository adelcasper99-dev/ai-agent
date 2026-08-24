import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';
import { calculateQuotation } from '../../src/lib/alumital/estimator';
import { buildSketchSvg, processMediaJob } from '../../src/lib/alumital/media_worker';
import { resolveActiveTools, executeTool } from '../lib/telegram_llm';
import Decimal from 'decimal.js';
import sharp from 'sharp';

describe('Casper Alumital Estimator E2E & RBAC Lifecycle', () => {
  let testTenantId: string;
  let adminChatId: string;
  let customerChatId: string;

  beforeAll(async () => {
    adminChatId = '123456789';
    customerChatId = '987654321';

    // Create or find a test tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: 'ورشة الألوميتال الحديثة للتجارة',
        merchantName: 'الأسطى محمود',
        telegramChatId: adminChatId,
        businessType: 'alumital_workshop',
      },
    });
    testTenantId = tenant.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.quotation.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.delete({ where: { id: testTenantId } });
  });

  it('1. Calculates and stores a draft quotation in DB using Decimal.js', async () => {
    const calcResult = calculateQuotation({
      width_cm: 120,
      height_cm: 140,
      quantity: 2,
      price_per_meter: 1500,
      extra_items: [
        { name: 'مقبض وكالون أمان', quantity: 2, unit_price: 150 },
        { name: 'دلفة سلك صلب', quantity: 2, unit_price: 200 },
      ],
      discount_pct: 5,
    });

    expect(calcResult.actual_area_sqm).toBe('3.36');
    expect(calcResult.billable_area_sqm).toBe('3.36');
    expect(calcResult.area_sqm).toBe('3.36');
    expect(calcResult.window_total).toBe('5040.00');
    expect(calcResult.subtotal_before_discount).toBe('5740.00');
    expect(calcResult.discount_applied).toBe('287.00');
    expect(calcResult.total_price).toBe('5453.00');

    // Save to Database
    const quotation = await prisma.quotation.create({
      data: {
        tenantId: testTenantId,
        customerRef: 'أحمد محمود',
        width_cm: new Decimal(120),
        height_cm: new Decimal(140),
        quantity: 2,
        price_per_meter: new Decimal(1500),
        area_sqm: new Decimal(calcResult.area_sqm),
        window_total: new Decimal(calcResult.window_total),
        extra_items: JSON.stringify(calcResult.extra_items),
        discount_pct: new Decimal(5),
        discount_amount: new Decimal(calcResult.discount_applied),
        subtotal_before_discount: new Decimal(calcResult.subtotal_before_discount),
        total_price: new Decimal(calcResult.total_price),
        status: 'draft',
      },
    });

    expect(quotation.id).toBeDefined();
    expect(quotation.status).toBe('draft');
    expect(quotation.total_price.toString()).toBe('5453');
  });

  it('2. Tool Routing: Resolves ALUMITAL cluster and calculate_alumital_quotation tool from message', () => {
    const prompt = 'احسبلي شباك ألوميتال مقاس 150 في 180 بسعر 1400 جنيه للمتر';
    const resolution = resolveActiveTools(prompt);
    
    expect(resolution.activeClusters).toContain('ALUMITAL');
    const hasTool = resolution.activeTools.some((t) => t.name === 'calculate_alumital_quotation');
    expect(hasTool).toBe(true);
  });

  it('3. Tool Execution: executeTool generates quotation draft with interactive response', async () => {
    const res = await executeTool(
      'calculate_alumital_quotation',
      {
        width_cm: 100,
        height_cm: 120,
        quantity: 1,
        price_per_meter: 1200,
        customer_ref: 'الحاج إبراهيم',
      },
      testTenantId,
      'احسبلي شباك 100 في 120',
      undefined,
      0,
      undefined,
      { chatId: adminChatId }
    );

    expect(res.success).toBe(true);
    expect(res.resultText).toContain('مقايسة ألوميتال مبدئية');
    expect(res.resultText).toContain('100 × 120 سم');
    expect(res.resultText).toContain('1440.00 ج.م');
  });

  it('4. Vector SVG & Sharp PNG: Generates valid vector sketch and binary PNG buffer', async () => {
    const svg = buildSketchSvg({ width_cm: 120, height_cm: 150 });
    expect(svg).toContain('<svg');
    expect(svg).toContain('العرض: 120 سم');
    expect(svg).toContain('الارتفاع: 150 سم');

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    expect(pngBuffer).toBeInstanceOf(Buffer);
    expect(pngBuffer.length).toBeGreaterThan(500);
  });

  it('5. End-to-End Media Worker: Generates PDF and PNG assets, locks DB status to completed', async () => {
    const draftQuote = await prisma.quotation.create({
      data: {
        tenantId: testTenantId,
        customerRef: 'مهندس مصطفى',
        width_cm: new Decimal(110),
        height_cm: new Decimal(130),
        quantity: 1,
        price_per_meter: new Decimal(1300),
        area_sqm: new Decimal('1.43'),
        window_total: new Decimal('1859.00'),
        subtotal_before_discount: new Decimal('1859.00'),
        total_price: new Decimal('1859.00'),
        status: 'draft',
      },
    });

    // Atomic lock from draft -> processing_media
    const lockResult = await prisma.quotation.updateMany({
      where: { id: draftQuote.id, status: 'draft' },
      data: { status: 'processing_media' },
    });
    expect(lockResult.count).toBe(1);

    // Run real media render job
    const job = await processMediaJob(draftQuote.id, testTenantId);
    expect(job.status).toBe('completed');
    expect(job.pdfUrl).toContain('.pdf');
    expect(job.sketchUrl).toContain('.png');

    const verified = await prisma.quotation.findUnique({ where: { id: draftQuote.id } });
    expect(verified?.status).toBe('completed');
    expect(verified?.pdfUrl).toBeDefined();
    expect(verified?.sketchUrl).toBeDefined();
  }, 30000);
});

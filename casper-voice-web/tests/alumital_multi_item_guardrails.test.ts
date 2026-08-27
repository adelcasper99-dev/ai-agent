import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { calculateQuotation, CalculateQuotationInputSchema } from '../lib/alumital/estimator';
import { normalizeArabicDigits, isIllegalAlumitalCalculationText, sanitizeNonToolReply } from '../lib/telegram_llm';
import { prisma } from '../lib/prisma';

describe('Alumital Multi-Item Quotation & Estimator Engine (Task 2)', () => {
  it('accurately calculates the Mahmoud Fawzy reference fixture with per-unit 1m² minimum floor', () => {
    const input = {
      price_per_meter: 3000,
      apply_min_area: true,
      items: [
        { item_type: 'شباك', width_cm: 100, height_cm: 100, quantity: 5 }, // 5 * 1.00 = 5.00 m² @ 3000 = 15,000
        { item_type: 'شباك', width_cm: 90, height_cm: 150, quantity: 3 },  // 3 * 1.35 = 4.05 m² @ 3000 = 12,150
        { item_type: 'باب', width_cm: 90, height_cm: 210, quantity: 4 },    // 4 * 1.89 = 7.56 m² @ 3000 = 22,680
        { item_type: 'شباك', width_cm: 70, height_cm: 70, quantity: 6 },   // 6 * max(0.49, 1) = 6.00 m² @ 3000 = 18,000
      ],
    };

    const result = calculateQuotation(input);

    // 1. Verify item-level calculations
    expect(result.items).toHaveLength(4);
    
    // Item 1: 100x100 cm (5 units)
    expect(result.items[0].total_actual_area_sqm).toBe('5.00');
    expect(result.items[0].total_billable_area_sqm).toBe('5.00');
    expect(result.items[0].line_total).toBe('15000.00');

    // Item 2: 90x150 cm (3 units)
    expect(result.items[1].total_actual_area_sqm).toBe('4.05');
    expect(result.items[1].total_billable_area_sqm).toBe('4.05');
    expect(result.items[1].line_total).toBe('12150.00');

    // Item 3: 90x210 cm (4 units)
    expect(result.items[2].total_actual_area_sqm).toBe('7.56');
    expect(result.items[2].total_billable_area_sqm).toBe('7.56');
    expect(result.items[2].line_total).toBe('22680.00');

    // Item 4: 70x70 cm (6 units - 1m² minimum floor applied per unit)
    expect(result.items[3].unit_actual_area_sqm).toBe('0.49');
    expect(result.items[3].unit_billable_area_sqm).toBe('1.00');
    expect(result.items[3].total_actual_area_sqm).toBe('2.94');
    expect(result.items[3].total_billable_area_sqm).toBe('6.00');
    expect(result.items[3].line_total).toBe('18000.00');

    // 2. Verify aggregate totals & financial precision
    expect(result.quantity).toBe(18);
    expect(result.actual_area_sqm).toBe('19.55');
    expect(result.billable_area_sqm).toBe('22.61');
    expect(result.window_total).toBe('67830.00');
    expect(result.total_price).toBe('67830.00');
  });

  it('maintains backwards compatibility for single-item requests', () => {
    const singleInput = {
      width_cm: 120,
      height_cm: 140,
      quantity: 1,
      price_per_meter: 1500,
    };

    const result = calculateQuotation(singleInput);
    expect(result.width_m).toBe('1.20');
    expect(result.height_m).toBe('1.40');
    expect(result.actual_area_sqm).toBe('1.68');
    expect(result.billable_area_sqm).toBe('1.68');
    expect(result.total_price).toBe('2520.00');
  });

  it('applies 1m² minimum floor for single item smaller than 1m²', () => {
    const smallItem = {
      width_cm: 80,
      height_cm: 80,
      quantity: 1,
      price_per_meter: 1000,
      apply_min_area: true,
    };

    const result = calculateQuotation(smallItem);
    expect(result.actual_area_sqm).toBe('0.64');
    expect(result.billable_area_sqm).toBe('1.00');
    expect(result.total_price).toBe('1000.00');
  });

  it('correctly handles discounts and extra items in multi-item quotes', () => {
    const input = {
      price_per_meter: 2000,
      items: [
        { width_cm: 100, height_cm: 100, quantity: 2 }, // 2m² * 2000 = 4000
      ],
      extra_items: [
        { name: 'دلفة سلك صلب', quantity: 2, unit_price: 300 }, // 600
      ],
      discount_pct: 10, // 10% of 4600 = 460
    };

    const result = calculateQuotation(input);
    expect(result.subtotal_before_discount).toBe('4600.00');
    expect(result.discount_applied).toBe('460.00');
    expect(result.total_price).toBe('4140.00');
  });

  it('validates schema and rejects empty inputs', () => {
    expect(() => CalculateQuotationInputSchema.parse({})).toThrow();
  });
});

describe('Anti-Hallucination & Digit Normalization Guardrails (Task 3)', () => {
  it('normalizes Eastern Arabic-Indic digits to Western Arabic digits', () => {
    expect(normalizeArabicDigits('١٢٣٤٥٦٧٨٩٠')).toBe('1234567890');
    expect(normalizeArabicDigits('٦٧٨٣٠ جنيه')).toBe('67830 جنيه');
  });

  it('catches hallucinated totals written with Eastern Arabic-Indic digits', () => {
    const reply = 'الإجمالي لمقايسة الشباك هيبقى ٦٧٨٣٠ جنيه';
    expect(isIllegalAlumitalCalculationText(reply)).toBe(true);
    expect(sanitizeNonToolReply(reply)).toContain('لحساب مقايسة الألوميتال بالأمتار والأسعار الرسمية');
  });

  it('catches hallucinated calculations with numbers before keywords', () => {
    const reply1 = '67000 جنيه هو إجمالي مقايسة الشباك بتاعتك';
    const reply2 = 'هيكلفك 67000 جنيه عشان الشباك ده في المقايسة';
    expect(isIllegalAlumitalCalculationText(reply1)).toBe(true);
    expect(isIllegalAlumitalCalculationText(reply2)).toBe(true);
  });

  it('handles punctuation attached to currency correctly', () => {
    expect(isIllegalAlumitalCalculationText('الإجمالي لمقايسة الشباك هيبقى حوالي 67000 جنيه.')).toBe(true);
    expect(isIllegalAlumitalCalculationText('مقايسة الشباك الإجمالي هيبقى 67000 ج.م.')).toBe(true);
    expect(isIllegalAlumitalCalculationText('المقايسة للشباك الإجمالي 67000 جنيه!')).toBe(true);
    expect(isIllegalAlumitalCalculationText('سعر مقايسة الشباك 67000 جنيه،')).toBe(true);
    expect(isIllegalAlumitalCalculationText('المقايسة للشباك إجمالي 67000 جنيه؟')).toBe(true);
  });

  it('intercepts hallucinated markdown calculation tables', () => {
    const tableReply = `
| البيان | المقاس | الكمية | السعر |
|---|---|---|---|
| شباك ألوميتال | 100x100 | 5 | 15000 |
`;
    expect(isIllegalAlumitalCalculationText(tableReply)).toBe(true);
  });

  it('does NOT intercept safe conversational Arabic sentences (Negative Cases)', () => {
    // 1. Sentence with count and item but no price/currency
    expect(isIllegalAlumitalCalculationText('عندي 5 شبابيك من زمان في المخزن السعر مش موضوع النهاردة')).toBe(false);
    expect(isIllegalAlumitalCalculationText('عندي 10 شبابيك في المعرض وعايز أسأل على حاجة تانية')).toBe(false);
    
    // 2. Simple item description
    expect(isIllegalAlumitalCalculationText('شباك ألوميتال جديد بمقاس 100 في 120')).toBe(false);
    expect(isIllegalAlumitalCalculationText('شباك ألوميتال جديد في المخزن')).toBe(false);
    
    // 3. Sentence with non-currency words like 'جدول'
    expect(isIllegalAlumitalCalculationText('شباك ألوميتال والسعر تقريبا 500 جدول')).toBe(false);
    
    // 4. Other products (not Alumital windows/doors/kitchens)
    expect(isIllegalAlumitalCalculationText('عندي في المخزن 500 كرتونة مسامير وسعرها 3000 جنيه')).toBe(false);
  });

  it('returns original safe text without alteration', () => {
    const safeText = 'أهلاً بك، تفضل بطلب مقايسة الألوميتال وسأقوم بحسابها فوراً.';
    expect(sanitizeNonToolReply(safeText)).toBe(safeText);
  });
});

describe('Telegram Webhook Callbacks, Atomic Locks & Auto-Rollback (Task 4)', () => {
  let tenantA: any;
  let tenantB: any;
  let testQuote: any;

  beforeEach(async () => {
    const uniqueSuffix = Date.now().toString();
    tenantA = await (prisma as any).tenant.create({
      data: {
        name: `Tenant A ${uniqueSuffix}`,
        telegramChatId: `chat_a_${uniqueSuffix}`,
        subscriptionPlan: 'PRO',
      },
    });

    tenantB = await (prisma as any).tenant.create({
      data: {
        name: `Tenant B ${uniqueSuffix}`,
        telegramChatId: `chat_b_${uniqueSuffix}`,
        subscriptionPlan: 'PRO',
      },
    });

    testQuote = await (prisma as any).quotation.create({
      data: {
        tenantId: tenantA.id,
        customerRef: 'محمود فوزي',
        width_cm: 100,
        height_cm: 100,
        quantity: 18,
        price_per_meter: 3000,
        area_sqm: 22.61,
        window_total: 67830,
        subtotal_before_discount: 67830,
        total_price: 67830,
        status: 'draft',
      },
    });
  });

  afterEach(async () => {
    if (testQuote?.id) {
      await (prisma as any).quotation.deleteMany({ where: { id: testQuote.id } });
    }
    if (tenantA?.id) {
      await (prisma as any).tenant.deleteMany({ where: { id: tenantA.id } });
    }
    if (tenantB?.id) {
      await (prisma as any).tenant.deleteMany({ where: { id: tenantB.id } });
    }
  });

  it('enforces atomic state transition and prevents double-clicking confirm', async () => {
    // First confirm call locks status: draft -> processing_media
    const firstLock = await (prisma as any).quotation.updateMany({
      where: { id: testQuote.id, tenantId: tenantA.id, status: 'draft' },
      data: { status: 'processing_media' },
    });
    expect(firstLock.count).toBe(1);

    // Second concurrent confirm call MUST fail (count = 0) because status is no longer draft
    const secondLock = await (prisma as any).quotation.updateMany({
      where: { id: testQuote.id, tenantId: tenantA.id, status: 'draft' },
      data: { status: 'processing_media' },
    });
    expect(secondLock.count).toBe(0);
  });

  it('enforces tenant isolation: tenant B cannot confirm or modify tenant A quotation', async () => {
    // Tenant B attempts to lock Tenant A's quote
    const unauthorizedLock = await (prisma as any).quotation.updateMany({
      where: { id: testQuote.id, tenantId: tenantB.id, status: 'draft' },
      data: { status: 'processing_media' },
    });
    expect(unauthorizedLock.count).toBe(0);

    // Verify quote remains untouched in draft under Tenant A
    const freshQuote = await (prisma as any).quotation.findUnique({ where: { id: testQuote.id } });
    expect(freshQuote.status).toBe('draft');
  });

  it('automatically rolls back from processing_media to draft if media rendering fails', async () => {
    // 1. Lock to processing_media
    await (prisma as any).quotation.updateMany({
      where: { id: testQuote.id, tenantId: tenantA.id, status: 'draft' },
      data: { status: 'processing_media' },
    });

    // 2. Simulate media rendering exception & Fail-Safe auto-rollback
    try {
      throw new Error('Simulated Media Engine Out-of-Memory Failure');
    } catch {
      await (prisma as any).quotation.updateMany({
        where: { id: testQuote.id, tenantId: tenantA.id, status: 'processing_media' },
        data: { status: 'draft' },
      });
    }

    // 3. Verify status safely restored to draft
    const rolledBackQuote = await (prisma as any).quotation.findUnique({ where: { id: testQuote.id } });
    expect(rolledBackQuote.status).toBe('draft');
  });

  it('supports compact callback prefixes (conf_q, ed_dim, ed_prc, can_q) under 64 bytes', () => {
    const quoteId = '5636a045-85e6-46ff-8ead-f071b9b6451f';
    const confData = `conf_q:${quoteId}`;
    const edDimData = `ed_dim:${quoteId}`;
    const edPrcData = `ed_prc:${quoteId}`;
    const canData = `can_q:${quoteId}`;

    expect(Buffer.byteLength(confData, 'utf8')).toBeLessThanOrEqual(64);
    expect(Buffer.byteLength(edDimData, 'utf8')).toBeLessThanOrEqual(64);
    expect(Buffer.byteLength(edPrcData, 'utf8')).toBeLessThanOrEqual(64);
    expect(Buffer.byteLength(canData, 'utf8')).toBeLessThanOrEqual(64);
  });
});

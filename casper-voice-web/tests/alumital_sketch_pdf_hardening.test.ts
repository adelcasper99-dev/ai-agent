import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';
import { buildSketchSvg, buildArabicQuotationHtml, processMediaJob } from '../lib/alumital/media_worker';
import fs from 'fs/promises';
import { existsSync } from 'fs';

describe('Alumital Multi-Item Sketch & Single-Page PDF Hardening Suite', () => {
  const testTenantId = 'tenant_sketch_test_' + Date.now();
  let createdQuoteId: string;

  beforeAll(async () => {
    // Create isolated test tenant
    await (prisma as any).tenant.create({
      data: {
        id: testTenantId,
        name: 'ورشة الألوميتال المعتمدة التجريبية',
        phoneNumber: '01099887766',
        state: 'active',
      },
    });
  });

  afterAll(async () => {
    // Cleanup test tenant and quotations
    if (createdQuoteId) {
      await prisma.quotation.deleteMany({ where: { id: createdQuoteId } }).catch(() => {});
    }
    await (prisma as any).tenant.deleteMany({ where: { id: testTenantId } }).catch(() => {});
  });

  // ==================== TEST 1: BYTE-LEVEL MOJIBAKE & ENCODING PURITY ====================
  it('1. Byte Purity: SVG blueprint output contains ZERO mojibake and pure Arabic UTF-8 strings', () => {
    const windowSvg = buildSketchSvg({
      width_cm: 100,
      height_cm: 120,
      item_type: 'شباك جرار دبل',
      quantity: 5,
      item_index: 1,
    });

    const doorSvg = buildSketchSvg({
      width_cm: 90,
      height_cm: 210,
      item_type: 'باب بلكونة ألوميتال',
      quantity: 2,
      item_index: 2,
    });

    const customSvg = buildSketchSvg({
      width_cm: 150,
      height_cm: 80,
      item_type: 'وحدة مطبخ علوية',
      quantity: 1,
      item_index: 3,
    });

    for (const svg of [windowSvg, doorSvg, customSvg]) {
      // Must NOT contain double-encoded ANSI/Latin1 mojibake characters
      expect(svg).not.toMatch(/[طظ][§©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿]/);
      // Must NOT contain Unicode replacement character
      expect(svg).not.toContain('\uFFFD');
      // Must contain correct Arabic labels
      expect(svg).toContain('العرض:');
      expect(svg).toContain('الارتفاع:');
      expect(svg).toContain('قطاع ألوميتال هندسي معتمد');
      expect(svg).toContain('مساحة الوحدة:');
    }

    expect(windowSvg).toContain('بند 1: شباك جرار دبل (5 قطع)');
    expect(doorSvg).toContain('بند 2: باب بلكونة ألوميتال (2 قطع)');
    expect(customSvg).toContain('بند 3: وحدة مطبخ علوية (1 قطع)');
  });

  // ==================== TEST 2: ARCHITECTURAL ITEM TYPE BLUEPRINTS ====================
  it('2. Item Type Fallbacks: Accurately renders door handle vs window mullions vs custom panel', () => {
    // Door must have door handle & swing arc
    const doorSvg = buildSketchSvg({ width_cm: 90, height_cm: 210, item_type: 'باب' });
    expect(doorSvg).toContain('Door Handle & Keyhole Knob');
    expect(doorSvg).toContain('Door Swing Arc Indicator');

    // Window must have central mullion interlock & glass reflection
    const windowSvg = buildSketchSvg({ width_cm: 120, height_cm: 120, item_type: 'شباك' });
    expect(windowSvg).toContain('Middle Mullion Interlock');
    expect(windowSvg).toContain('Glass reflection light glare');

    // Custom element (Kitchen / Partition) must have clean architectural body without errors
    const kitchenSvg = buildSketchSvg({ width_cm: 150, height_cm: 70, item_type: 'مطبخ ألوميتال' });
    expect(kitchenSvg).toContain('Neutral Panel Body');
    expect(kitchenSvg).toContain('Architectural Grid Lines');

    // Generic / undefined fallback must default cleanly
    const genericSvg = buildSketchSvg({ width_cm: 80, height_cm: 100 });
    expect(genericSvg).toContain('العرض: 80 سم');
    expect(genericSvg).toContain('الارتفاع: 100 سم');
  });

  // ==================== TEST 3: SINGLE-PAGE HTML TEMPLATE DESIGN ====================
  it('3. Single-Page Template: Formats compact multi-item bento grid and single page A4 CSS', () => {
    const mockItems = [
      { item_type: 'شباك', width_cm: 100, height_cm: 100, quantity: 5, price_per_meter: '3000.00', total_billable_area_sqm: '5.00', line_total: '15000.00' },
      { item_type: 'شباك', width_cm: 90, height_cm: 150, quantity: 3, price_per_meter: '3000.00', total_billable_area_sqm: '4.05', line_total: '12150.00' },
      { item_type: 'باب', width_cm: 90, height_cm: 210, quantity: 4, price_per_meter: '3000.00', total_billable_area_sqm: '7.56', line_total: '22680.00' },
      { item_type: 'شباك', width_cm: 70, height_cm: 70, quantity: 6, price_per_meter: '3000.00', total_billable_area_sqm: '6.00', unit_billable_area_sqm: '1.00', line_total: '18000.00' },
    ];

    const html = buildArabicQuotationHtml({
      quoteId: 'quote_test_12345678',
      tenantName: 'شركة النصر للألوميتال',
      customerRef: 'أحمد فوزي',
      dateStr: '27 أغسطس 2026',
      width_cm: 100,
      height_cm: 100,
      quantity: 18,
      price_per_meter: '3000.00',
      area_sqm: '22.61',
      window_total: '67830.00',
      items: mockItems,
      subtotal_before_discount: '67830.00',
      discount_applied: '0.00',
      total_price: '67830.00',
      sketches: mockItems.map((it, idx) => ({
        itemIndex: idx + 1,
        itemType: it.item_type,
        width_cm: it.width_cm,
        height_cm: it.height_cm,
        quantity: it.quantity,
        pngBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      })),
    });

    expect(html).toContain('size: A4 portrait;');
    expect(html).toContain('sketch-matrix-section');
    expect(html).toContain('sketch-grid');
    expect(html).toContain('بند 1: شباك (100×100)');
    expect(html).toContain('بند 3: باب (90×210)');
    expect(html).toContain('بند 4: شباك (70×70)');
    expect(html).toContain('67830.00 ج.م');
    expect(html).toContain('(حد أدنى 1م²)');
    expect(html).toContain('sketchModal');
    expect(html).toContain('openSketchModal');
    expect(html).toContain('closeSketchModal');
    expect(html).toContain('@media print');
  });

  // ==================== TEST 4: E2E MULTI-ITEM MEDIA WORKER RENDERING ====================
  it('4. E2E Media Worker: Generates individual item PNGs (>5KB each) and Single-Page PDF (>10KB)', async () => {
    const multiItems = [
      { item_type: 'شباك', width_cm: 100, height_cm: 100, quantity: 5, price_per_meter: '3000.00', total_billable_area_sqm: '5.00', line_total: '15000.00' },
      { item_type: 'شباك', width_cm: 90, height_cm: 150, quantity: 3, price_per_meter: '3000.00', total_billable_area_sqm: '4.05', line_total: '12150.00' },
      { item_type: 'باب', width_cm: 90, height_cm: 210, quantity: 4, price_per_meter: '3000.00', total_billable_area_sqm: '7.56', line_total: '22680.00' },
      { item_type: 'شباك', width_cm: 70, height_cm: 70, quantity: 6, price_per_meter: '3000.00', total_billable_area_sqm: '6.00', unit_billable_area_sqm: '1.00', line_total: '18000.00' },
    ];

    // Create DB quotation draft
    const quote = await prisma.quotation.create({
      data: {
        tenantId: testTenantId,
        customerRef: 'أحمد فوزي',
        width_cm: 100,
        height_cm: 100,
        quantity: 18,
        price_per_meter: 3000,
        area_sqm: 22.61,
        window_total: 67830,
        items: JSON.stringify(multiItems),
        subtotal_before_discount: 67830,
        total_price: 67830,
        status: 'draft',
      },
    });
    createdQuoteId = quote.id;

    // Run processMediaJob
    const result = await processMediaJob(createdQuoteId, testTenantId);

    expect(result.status).toBe('completed');
    expect(result.sketches).toBeDefined();
    expect(result.sketches?.length).toBe(4);

    // Verify each item's sketch file on disk and byte size
    for (let i = 0; i < 4; i++) {
      const sk = result.sketches![i];
      expect(sk.itemIndex).toBe(i + 1);
      expect(existsSync(sk.pngPath)).toBe(true);
      expect(existsSync(sk.svgPath)).toBe(true);

      const buf = await fs.readFile(sk.pngPath);
      // Assert non-empty, rich PNG buffer (> 5,000 bytes)
      expect(buf.length).toBeGreaterThan(5000);
    }

    // Verify PDF file on disk and byte size
    expect(result.pdfPath).toBeDefined();
    expect(existsSync(result.pdfPath!)).toBe(true);
    const pdfBuf = await fs.readFile(result.pdfPath!);
    // Assert non-empty PDF (> 10,000 bytes)
    expect(pdfBuf.length).toBeGreaterThan(10000);

    // Verify database record updated to completed
    const updatedQuote = await prisma.quotation.findUnique({ where: { id: createdQuoteId } });
    expect(updatedQuote?.status).toBe('completed');
    expect(updatedQuote?.pdfUrl).toContain('.pdf');
  }, 30000);
});

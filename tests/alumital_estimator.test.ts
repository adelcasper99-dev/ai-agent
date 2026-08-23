import { describe, it, expect } from 'vitest';
import { calculateQuotation } from '../src/lib/alumital/estimator';

describe('Casper Alumital Estimator Financial Engine', () => {
  it('calculates standard window quotation accurately with Decimal.js', () => {
    const res = calculateQuotation({
      width_cm: 120,
      height_cm: 140,
      quantity: 2,
      price_per_meter: 1500,
    });

    // 1.2m * 1.4m = 1.68 sqm
    expect(res.area_sqm).toBe('1.68');
    // 1.68 sqm * 1500 EGP * 2 = 5040.00 EGP
    expect(res.window_total).toBe('5040.00');
    expect(res.total_price).toBe('5040.00');
  });

  it('enforces minimum area threshold of 1.00 sqm when dimensions are smaller', () => {
    const res = calculateQuotation({
      width_cm: 50,
      height_cm: 60,
      quantity: 1,
      price_per_meter: 2000,
      apply_min_area: true,
    });

    // 0.5 * 0.6 = 0.3 sqm -> bumped to 1.00 sqm
    expect(res.area_sqm).toBe('1.00');
    expect(res.window_total).toBe('2000.00');
    expect(res.total_price).toBe('2000.00');
  });

  it('calculates extra items and discounts correctly without floating point errors', () => {
    const res = calculateQuotation({
      width_cm: 200,
      height_cm: 200,
      quantity: 1,
      price_per_meter: 1000,
      extra_items: [
        { name: 'Handle & Lock', quantity: 2, unit_price: 150 },
        { name: 'Flyscreen Net', quantity: 1, unit_price: 300 },
      ],
      discount_pct: 10,
    });

    // 2.0 * 2.0 = 4.00 sqm
    expect(res.area_sqm).toBe('4.00');
    // window_total = 4000.00
    expect(res.window_total).toBe('4000.00');
    // extra: (2 * 150) + (1 * 300) = 600.00
    expect(res.subtotal_before_discount).toBe('4600.00');
    // 10% discount on 4600 = 460.00 -> total = 4140.00
    expect(res.discount_applied).toBe('460.00');
    expect(res.total_price).toBe('4140.00');
  });

  it('rejects invalid dimensions outside 30-500cm range', () => {
    expect(() => {
      calculateQuotation({
        width_cm: 10,
        height_cm: 140,
        quantity: 1,
        price_per_meter: 1500,
      });
    }).toThrow();
  });
});

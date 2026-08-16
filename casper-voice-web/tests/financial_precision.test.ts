import { describe, it, expect } from 'vitest';
import {
  parseMoney,
  toPiastres,
  fromPiastres,
  formatMoney,
  calculateSaleTotals,
  calculatePurchaseTotals,
  calculateNetProfit,
  Decimal,
} from '../lib/financial';

describe('Finding #2: Financial Precision Engine (Decimal.js & Zero Float Math)', () => {
  describe('1. parseMoney & Rounding Rules', () => {
    it('accurately parses strings with commas and symbols', () => {
      expect(parseMoney('1,500.50 EGP').toFixed(2)).toBe('1500.50');
      expect(parseMoney('  2,345,678.90  ').toFixed(2)).toBe('2345678.90');
      expect(parseMoney(null, 10).toFixed(2)).toBe('10.00');
      expect(parseMoney('', 0).toFixed(2)).toBe('0.00');
    });

    it('enforces commercial rounding (ROUND_HALF_UP)', () => {
      expect(parseMoney('10.005').toFixed(2)).toBe('10.01');
      expect(parseMoney('10.004').toFixed(2)).toBe('10.00');
      expect(parseMoney('10.125').toFixed(2)).toBe('10.13');
      expect(parseMoney('10.124').toFixed(2)).toBe('10.12');
    });
  });

  describe('2. Piastres (قرش × 100) Conversions', () => {
    it('converts pounds to exact integer piastres without IEEE-754 binary float errors', () => {
      expect(toPiastres(15.5)).toBe(1550);
      expect(toPiastres('199.99')).toBe(19999);
      expect(toPiastres('0.01')).toBe(1);
      expect(toPiastres(0)).toBe(0);
    });

    it('converts piastres back to exact 2-decimal pounds', () => {
      expect(fromPiastres(1550).toFixed(2)).toBe('15.50');
      expect(fromPiastres(19999).toFixed(2)).toBe('199.99');
      expect(fromPiastres(1).toFixed(2)).toBe('0.01');
      expect(fromPiastres(0).toFixed(2)).toBe('0.00');
    });

    it('round-trips between Decimal and Piastres perfectly', () => {
      const amounts = ['0.01', '1.50', '99.99', '12345.67', '999999.99'];
      for (const amt of amounts) {
        const piastres = toPiastres(amt);
        const reconstructed = fromPiastres(piastres);
        expect(reconstructed.toFixed(2)).toBe(amt);
      }
    });
  });

  describe('3. Sale Financial Math (calculateSaleTotals)', () => {
    it('calculates cash sale with full payment', () => {
      const result = calculateSaleTotals('25.50', 4);
      expect(result.priceStr).toBe('25.50');
      expect(result.quantity).toBe(4);
      expect(result.totalStr).toBe('102.00');
      expect(result.paidAmountStr).toBe('102.00');
      expect(result.deferredAmountStr).toBe('0.00');
      expect(result.totalPiastres).toBe(10200);
      expect(result.deferredPiastres).toBe(0);
    });

    it('calculates partial payment and deferred balance', () => {
      const result = calculateSaleTotals('33.33', 3, '50.00');
      expect(result.totalStr).toBe('99.99');
      expect(result.paidAmountStr).toBe('50.00');
      expect(result.deferredAmountStr).toBe('49.99');
      expect(result.totalPiastres).toBe(9999);
      expect(result.paidPiastres).toBe(5000);
      expect(result.deferredPiastres).toBe(4999);
    });

    it('caps paidAmount at total when overpaid', () => {
      const result = calculateSaleTotals('50.00', 1, '200.00');
      expect(result.totalStr).toBe('50.00');
      expect(result.paidAmountStr).toBe('50.00');
      expect(result.deferredAmountStr).toBe('0.00');
    });
  });

  describe('4. Purchase Financial Math (calculatePurchaseTotals)', () => {
    it('calculates supplier debt accurately', () => {
      const result = calculatePurchaseTotals('5000.00', '1500.00');
      expect(result.totalAmountStr).toBe('5000.00');
      expect(result.paidAmountStr).toBe('1500.00');
      expect(result.deferredAmountStr).toBe('3500.00');
      expect(result.deferredPiastres).toBe(350000);
    });
  });

  describe('5. Net Profit (calculateNetProfit)', () => {
    it('calculates net profit: Revenue - (Expenses + Purchases)', () => {
      const profit = calculateNetProfit('10000.00', '1500.50', '4200.25');
      expect(profit.toFixed(2)).toBe('4299.25');
    });

    it('handles negative profit (loss)', () => {
      const profit = calculateNetProfit('1000.00', '1500.00', '500.00');
      expect(profit.toFixed(2)).toBe('-1000.00');
    });
  });

  describe('6. Formatting (formatMoney)', () => {
    it('formats numbers with thousand separators and optional currency symbol', () => {
      expect(formatMoney('1500000.50', 'ج.م')).toBe('1,500,000.50 ج.م');
      expect(formatMoney('99.9')).toBe('99.90');
    });
  });

  describe('7. High-Volume Summation Invariance (Zero Float Drift)', () => {
    it('sums 10,000 fractional items without 1 piastre of drift', () => {
      let sum = new Decimal(0);
      for (let i = 0; i < 10000; i++) {
        sum = sum.plus(parseMoney('0.01'));
      }
      expect(sum.toFixed(2)).toBe('100.00');
      expect(toPiastres(sum)).toBe(10000);
    });
  });
});

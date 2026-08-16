import Decimal from 'decimal.js';

/**
 * lib/financial.ts
 *
 * Enterprise Financial Precision Engine for Casper POS & Voice ERP.
 *
 * Directives:
 * 1. Strict Decimal Precision: Zero IEEE-754 native JavaScript float math (+, -, *, /).
 * 2. Mandatory Rounding Mode: Decimal.ROUND_HALF_UP (Commercial Rounding).
 * 3. Dual Mode Arithmetic: Arbitrary-precision Decimal objects + Integer Piastres (قرش × 100).
 */

// Configure default precision and commercial rounding rule across all operations
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 21,
});

export { Decimal };

/**
 * Safely parses any value (number, string, Decimal) into a sanitized 2-decimal Decimal object.
 */
export function parseMoney(val: Decimal.Value | null | undefined, fallback: Decimal.Value = 0): Decimal {
  if (val === null || val === undefined || val === '') {
    return new Decimal(fallback).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
  try {
    if (typeof val === 'string') {
      // Remove commas, Arabic currency characters, and whitespace
      const clean = val.replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
      if (!clean || clean === '-' || clean === '.') {
        return new Decimal(fallback).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }
      return new Decimal(clean).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
    return new Decimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  } catch {
    return new Decimal(fallback).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
}

/**
 * Converts a monetary value to integer Piastres (قرش = pounds × 100) without float rounding errors.
 */
export function toPiastres(val: Decimal.Value | null | undefined): number {
  return parseMoney(val).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Converts integer Piastres (قرش) back into a 2-decimal Decimal currency unit.
 */
export function fromPiastres(piastres: number): Decimal {
  if (!Number.isFinite(piastres)) return new Decimal(0).toDecimalPlaces(2);
  return new Decimal(Math.round(piastres)).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Formats a monetary value for display with thousand separators and 2 fixed decimal places.
 */
export function formatMoney(val: Decimal.Value | null | undefined, currency: string = ''): string {
  const d = parseMoney(val);
  const formatted = d.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return currency ? `${formatted} ${currency}`.trim() : formatted;
}

export interface SaleFinancialSummary {
  price: Decimal;
  quantity: number;
  total: Decimal;
  paidAmount: Decimal;
  deferredAmount: Decimal;
  priceStr: string;
  totalStr: string;
  paidAmountStr: string;
  deferredAmountStr: string;
  pricePiastres: number;
  totalPiastres: number;
  paidPiastres: number;
  deferredPiastres: number;
}

/**
 * Calculates item totals, paid amount, and deferred debt for a sale with strict Decimal.js math.
 */
export function calculateSaleTotals(
  price: Decimal.Value,
  quantity: number = 1,
  paidAmount?: Decimal.Value | null
): SaleFinancialSummary {
  const priceDec = parseMoney(price);
  const qty = Math.max(1, Math.floor(quantity || 1));
  const totalDec = priceDec.times(qty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const paidDec =
    paidAmount !== undefined && paidAmount !== null && paidAmount !== ''
      ? Decimal.min(totalDec, parseMoney(paidAmount))
      : totalDec;

  const deferredDec = Decimal.max(0, totalDec.minus(paidDec)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    price: priceDec,
    quantity: qty,
    total: totalDec,
    paidAmount: paidDec,
    deferredAmount: deferredDec,
    priceStr: priceDec.toFixed(2),
    totalStr: totalDec.toFixed(2),
    paidAmountStr: paidDec.toFixed(2),
    deferredAmountStr: deferredDec.toFixed(2),
    pricePiastres: toPiastres(priceDec),
    totalPiastres: toPiastres(totalDec),
    paidPiastres: toPiastres(paidDec),
    deferredPiastres: toPiastres(deferredDec),
  };
}

export interface PurchaseFinancialSummary {
  totalAmount: Decimal;
  paidAmount: Decimal;
  deferredAmount: Decimal;
  totalAmountStr: string;
  paidAmountStr: string;
  deferredAmountStr: string;
  totalPiastres: number;
  paidPiastres: number;
  deferredPiastres: number;
}

/**
 * Calculates purchase totals, paid amount, and supplier deferred debt with strict Decimal.js math.
 */
export function calculatePurchaseTotals(
  totalAmount: Decimal.Value,
  paidAmount?: Decimal.Value | null
): PurchaseFinancialSummary {
  const totalDec = parseMoney(totalAmount);
  const paidDec =
    paidAmount !== undefined && paidAmount !== null && paidAmount !== ''
      ? Decimal.min(totalDec, parseMoney(paidAmount))
      : totalDec;

  const deferredDec = Decimal.max(0, totalDec.minus(paidDec)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    totalAmount: totalDec,
    paidAmount: paidDec,
    deferredAmount: deferredDec,
    totalAmountStr: totalDec.toFixed(2),
    paidAmountStr: paidDec.toFixed(2),
    deferredAmountStr: deferredDec.toFixed(2),
    totalPiastres: toPiastres(totalDec),
    paidPiastres: toPiastres(paidDec),
    deferredPiastres: toPiastres(deferredDec),
  };
}

/**
 * Calculates net profit: Sales Revenue - (Expenses + Purchases).
 */
export function calculateNetProfit(
  totalSales: Decimal.Value,
  totalExpenses: Decimal.Value,
  totalPurchases: Decimal.Value
): Decimal {
  const sales = parseMoney(totalSales);
  const expenses = parseMoney(totalExpenses);
  const purchases = parseMoney(totalPurchases);
  return sales.minus(expenses).minus(purchases).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

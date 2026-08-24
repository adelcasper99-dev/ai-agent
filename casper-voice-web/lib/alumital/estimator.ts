import Decimal from 'decimal.js';
import { z } from 'zod';

export const ExtraItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unit_price: z.number().nonnegative('Unit price must be non-negative'),
});

export const CalculateQuotationInputSchema = z.object({
  width_cm: z.number().min(30, 'Width must be at least 30 cm').max(500, 'Width cannot exceed 500 cm'),
  height_cm: z.number().min(30, 'Height must be at least 30 cm').max(500, 'Height cannot exceed 500 cm'),
  quantity: z.number().int().positive('Quantity must be at least 1').default(1),
  price_per_meter: z.number().positive('Price per meter must be positive'),
  apply_min_area: z.boolean().default(true),
  extra_items: z.array(ExtraItemSchema).optional().default([]),
  discount_pct: z.number().min(0).max(100).optional().default(0),
  discount_amount: z.number().min(0).optional().default(0),
});

export type CalculateQuotationInput = z.input<typeof CalculateQuotationInputSchema>;

export interface ExtraItemResult {
  name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
}

export interface QuotationResult {
  width_m: string;
  height_m: string;
  quantity: number;
  actual_area_sqm: string;
  billable_area_sqm: string;
  area_sqm: string; // backwards compatibility alias for billable_area_sqm
  window_total: string;
  extra_items: ExtraItemResult[];
  subtotal_before_discount: string;
  discount_applied: string;
  total_price: string;
}

export function calculateQuotation(rawInput: CalculateQuotationInput): QuotationResult {
  const input = CalculateQuotationInputSchema.parse(rawInput);

  const width = new Decimal(input.width_cm).div(100);
  const height = new Decimal(input.height_cm).div(100);
  const qty = new Decimal(input.quantity);
  const price = new Decimal(input.price_per_meter);

  // 1. Actual physical cut area per unit & total
  const actualAreaPerUnit = width.times(height);
  const actualAreaTotal = actualAreaPerUnit.times(qty);

  // 2. Minimum billable area floor calculated per individual unit
  const billableAreaPerUnit = input.apply_min_area
    ? Decimal.max(actualAreaPerUnit, new Decimal(1))
    : actualAreaPerUnit;
  const billableAreaTotal = billableAreaPerUnit.times(qty);

  // 3. Window base total calculation
  const windowTotal = billableAreaTotal.times(price);

  const extraLines: ExtraItemResult[] = (input.extra_items || []).map((item) => {
    const itemQty = new Decimal(item.quantity);
    const itemUnitPrice = new Decimal(item.unit_price);
    const lineTotal = itemUnitPrice.times(itemQty);
    return {
      name: item.name,
      quantity: item.quantity,
      unit_price: itemUnitPrice.toFixed(2),
      line_total: lineTotal.toFixed(2),
    };
  });

  const extraTotal = extraLines.reduce(
    (sum, line) => sum.plus(new Decimal(line.line_total)),
    new Decimal(0)
  );

  const subtotalBeforeDiscount = windowTotal.plus(extraTotal);
  let total = new Decimal(subtotalBeforeDiscount);
  let discountApplied = new Decimal(0);

  if (input.discount_pct && input.discount_pct > 0) {
    const pctDiscount = subtotalBeforeDiscount.times(new Decimal(input.discount_pct).div(100));
    discountApplied = discountApplied.plus(pctDiscount);
  }

  if (input.discount_amount && input.discount_amount > 0) {
    discountApplied = discountApplied.plus(new Decimal(input.discount_amount));
  }

  total = subtotalBeforeDiscount.minus(discountApplied);
  if (total.lessThan(0)) {
    total = new Decimal(0);
  }

  return {
    width_m: width.toFixed(2),
    height_m: height.toFixed(2),
    quantity: input.quantity,
    actual_area_sqm: actualAreaTotal.toFixed(2),
    billable_area_sqm: billableAreaTotal.toFixed(2),
    area_sqm: billableAreaTotal.toFixed(2),
    window_total: windowTotal.toFixed(2),
    extra_items: extraLines,
    subtotal_before_discount: subtotalBeforeDiscount.toFixed(2),
    discount_applied: discountApplied.toFixed(2),
    total_price: total.toFixed(2),
  };
}

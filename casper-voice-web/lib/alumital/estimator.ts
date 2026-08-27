import Decimal from 'decimal.js';
import { z } from 'zod';

export const ExtraItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unit_price: z.number().nonnegative('Unit price must be non-negative'),
});

export const QuotationItemInputSchema = z.object({
  item_type: z.string().optional().default('شباك'),
  width_cm: z.number().min(30, 'Width must be at least 30 cm').max(500, 'Width cannot exceed 500 cm'),
  height_cm: z.number().min(30, 'Height must be at least 30 cm').max(500, 'Height cannot exceed 500 cm'),
  quantity: z.number().int().positive('Quantity must be at least 1').default(1),
  price_per_meter: z.number().positive('Price per meter must be positive').optional(),
  apply_min_area: z.boolean().default(true),
});

export const CalculateQuotationInputSchema = z
  .object({
    width_cm: z.number().min(30, 'Width must be at least 30 cm').max(500, 'Width cannot exceed 500 cm').optional(),
    height_cm: z.number().min(30, 'Height must be at least 30 cm').max(500, 'Height cannot exceed 500 cm').optional(),
    quantity: z.number().int().positive('Quantity must be at least 1').default(1),
    price_per_meter: z.number().positive('Price per meter must be positive').optional().default(1200),
    apply_min_area: z.boolean().default(true),
    items: z.array(QuotationItemInputSchema).optional(),
    extra_items: z.array(ExtraItemSchema).optional().default([]),
    discount_pct: z.number().min(0).max(100).optional().default(0),
    discount_amount: z.number().min(0).optional().default(0),
  })
  .refine(
    (data) => (data.items && data.items.length > 0) || (data.width_cm !== undefined && data.height_cm !== undefined),
    { message: 'Either items array or both width_cm and height_cm must be provided' }
  );

export type CalculateQuotationInput = z.input<typeof CalculateQuotationInputSchema>;

export interface ExtraItemResult {
  name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
}

export interface CalculatedItemResult {
  item_type: string;
  width_cm: number;
  height_cm: number;
  width_m: string;
  height_m: string;
  quantity: number;
  unit_actual_area_sqm: string;
  unit_billable_area_sqm: string;
  total_actual_area_sqm: string;
  total_billable_area_sqm: string;
  price_per_meter: string;
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
  items: CalculatedItemResult[];
  extra_items: ExtraItemResult[];
  subtotal_before_discount: string;
  discount_applied: string;
  total_price: string;
}

export function calculateQuotation(rawInput: CalculateQuotationInput): QuotationResult {
  const input = CalculateQuotationInputSchema.parse(rawInput);

  const globalPrice = new Decimal(input.price_per_meter || 1200);

  // Normalize single-item or multi-item into effectiveItems list
  const effectiveItems =
    input.items && input.items.length > 0
      ? input.items
      : [
          {
            item_type: 'شباك',
            width_cm: input.width_cm!,
            height_cm: input.height_cm!,
            quantity: input.quantity || 1,
            price_per_meter: input.price_per_meter,
            apply_min_area: input.apply_min_area,
          },
        ];

  let totalActualArea = new Decimal(0);
  let totalBillableArea = new Decimal(0);
  let totalWindowPrice = new Decimal(0);
  let totalQuantity = 0;

  const calculatedItems: CalculatedItemResult[] = effectiveItems.map((item) => {
    const w = new Decimal(item.width_cm).div(100);
    const h = new Decimal(item.height_cm).div(100);
    const q = new Decimal(item.quantity);
    const itemPrice = item.price_per_meter ? new Decimal(item.price_per_meter) : globalPrice;
    const shouldApplyMin = item.apply_min_area !== undefined ? item.apply_min_area : input.apply_min_area;

    // 1. Actual physical cut area per unit & total
    const actualUnitArea = w.times(h);
    const actualLineArea = actualUnitArea.times(q);

    // 2. Minimum billable area floor calculated per individual unit (1m² floor)
    const billableUnitArea = shouldApplyMin ? Decimal.max(actualUnitArea, new Decimal(1)) : actualUnitArea;
    const billableLineArea = billableUnitArea.times(q);

    // 3. Line total calculation
    const lineTotal = billableLineArea.times(itemPrice);

    totalActualArea = totalActualArea.plus(actualLineArea);
    totalBillableArea = totalBillableArea.plus(billableLineArea);
    totalWindowPrice = totalWindowPrice.plus(lineTotal);
    totalQuantity += item.quantity;

    return {
      item_type: item.item_type || 'شباك',
      width_cm: item.width_cm,
      height_cm: item.height_cm,
      width_m: w.toFixed(2),
      height_m: h.toFixed(2),
      quantity: item.quantity,
      unit_actual_area_sqm: actualUnitArea.toFixed(2),
      unit_billable_area_sqm: billableUnitArea.toFixed(2),
      total_actual_area_sqm: actualLineArea.toFixed(2),
      total_billable_area_sqm: billableLineArea.toFixed(2),
      price_per_meter: itemPrice.toFixed(2),
      line_total: lineTotal.toFixed(2),
    };
  });

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

  const subtotalBeforeDiscount = totalWindowPrice.plus(extraTotal);
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

  const firstItem = calculatedItems[0];

  return {
    width_m: firstItem ? firstItem.width_m : '0.00',
    height_m: firstItem ? firstItem.height_m : '0.00',
    quantity: totalQuantity,
    actual_area_sqm: totalActualArea.toFixed(2),
    billable_area_sqm: totalBillableArea.toFixed(2),
    area_sqm: totalBillableArea.toFixed(2),
    window_total: totalWindowPrice.toFixed(2),
    items: calculatedItems,
    extra_items: extraLines,
    subtotal_before_discount: subtotalBeforeDiscount.toFixed(2),
    discount_applied: discountApplied.toFixed(2),
    total_price: total.toFixed(2),
  };
}

import { prisma } from "@/lib/prisma";
// app/api/sales/route.ts
import { NextRequest, NextResponse } from "next/server";
import Decimal from "decimal.js";
import { getResolvedTenantId } from "@/lib/auth";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });


// In-memory idempotency cache (60 seconds)
const salesIdempotencyMap = new Map<string, { timestamp: number; response: any }>();

export async function POST(req: NextRequest) {
  try {
    const resolvedTenantId = await getResolvedTenantId(req);
    if (!resolvedTenantId) {
      return NextResponse.json({ error: "غير مصرح: يجب تسجيل الدخول كمؤسسة" }, { status: 401 });
    }

    const idempotencyKey = req.headers.get("idempotency-key");
    const now = Date.now();
    if (idempotencyKey) {
      const cached = salesIdempotencyMap.get(idempotencyKey);
      if (cached && now - cached.timestamp < 60000) {
        return NextResponse.json({ ...cached.response, cached: true });
      }
      
      const existingSale = await prisma.sale.findUnique({ where: { idempotencyKey } });
      if (existingSale) {
        const cachedRes = { success: true, sale: existingSale, deferredAmount: existingSale.deferredAmount, cached: true };
        salesIdempotencyMap.set(idempotencyKey, { timestamp: now, response: cachedRes });
        return NextResponse.json(cachedRes);
      }
    }

    const body = await req.json();
    const { item_name, price, quantity = 1, customer_name = "", paid_amount, idempotency_key: bodyKey } = body;
    const effectiveKey = idempotencyKey || (bodyKey ? String(bodyKey) : undefined);

    if (!item_name || typeof price !== "number" || price <= 0) {
      return NextResponse.json({ error: "item_name و price مطلوبين (السعر يجب أن يكون أكبر من صفر)" }, { status: 400 });
    }

    const qty = quantity && quantity > 0 ? quantity : 1;
    const priceDecimal = new Decimal(price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalDecimal = priceDecimal.times(qty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const total = totalDecimal.toNumber();

    const paidDecimal = typeof paid_amount === "number" 
      ? new Decimal(paid_amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) 
      : totalDecimal;
    const paid = paidDecimal.toNumber();
    const deferredDecimal = Decimal.max(0, totalDecimal.minus(paidDecimal)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const deferred = deferredDecimal.toNumber();

    const sale = await prisma.sale.create({
      data: {
        itemName: item_name.trim(),
        price: priceDecimal.toNumber(),
        quantity: qty,
        total,
        customerName: customer_name ? customer_name.trim() : "عميل نقدي",
        paidAmount: paid,
        deferredAmount: deferred,
        ...(effectiveKey && { idempotencyKey: effectiveKey }),
        tenantId: resolvedTenantId,
      },
    });

    const responsePayload = { success: true, sale, deferredAmount: deferred };

    if (effectiveKey) {
      salesIdempotencyMap.set(effectiveKey, { timestamp: now, response: responsePayload });
    }

    return NextResponse.json(responsePayload);
  } catch (err) {
    console.error("[Sales POST Error]", err);
    return NextResponse.json({ error: "حصل خطأ في تسجيل عملية البيع" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const tenantId = await getResolvedTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const sales = await prisma.sale.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ sales });
}


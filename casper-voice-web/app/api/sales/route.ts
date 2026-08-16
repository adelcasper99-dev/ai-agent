import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getResolvedTenantId } from "@/lib/auth";
import { calculateSaleTotals, parseMoney } from "@/lib/financial";

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
      
      const existingSale = await prisma.sale.findFirst({ where: { tenantId: resolvedTenantId, idempotencyKey } });
      if (existingSale) {
        const cachedRes = { success: true, sale: existingSale, deferredAmount: existingSale.deferredAmount, cached: true };
        salesIdempotencyMap.set(idempotencyKey, { timestamp: now, response: cachedRes });
        return NextResponse.json(cachedRes);
      }
    }

    const body = await req.json();
    const { item_name, price, quantity = 1, customer_name = "", paid_amount, idempotency_key: bodyKey } = body;
    const effectiveKey = idempotencyKey || (bodyKey ? String(bodyKey) : undefined);

    const priceDec = parseMoney(price);
    if (!item_name || priceDec.isZero() || !priceDec.isPositive()) {
      return NextResponse.json({ error: "item_name و price مطلوبين (السعر يجب أن يكون أكبر من صفر)" }, { status: 400 });
    }

    const financials = calculateSaleTotals(priceDec, quantity, paid_amount);

    const sale = await prisma.sale.create({
      data: {
        itemName: item_name.trim(),
        price: financials.priceStr,
        quantity: financials.quantity,
        total: financials.totalStr,
        customerName: customer_name ? customer_name.trim() : "عميل نقدي",
        paidAmount: financials.paidAmountStr,
        deferredAmount: financials.deferredAmountStr,
        ...(effectiveKey && { idempotencyKey: effectiveKey }),
        tenantId: resolvedTenantId,
      },
    });

    const responsePayload = {
      success: true,
      sale,
      deferredAmount: financials.deferredAmount.toNumber(),
      deferredAmountStr: financials.deferredAmountStr,
    };

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
  const sessionTenantId = await getResolvedTenantId(req);
  const queryTenantId = req.nextUrl.searchParams.get("tenantId");

  const effectiveTenantId = queryTenantId ?? sessionTenantId;
  const where: any = {};
  if (effectiveTenantId && effectiveTenantId !== "all") {
    where.tenantId = effectiveTenantId;
  }

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ sales });
}

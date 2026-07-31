// app/api/sales/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { item_name, price, quantity = 1, customer_name = "", paid_amount, tenantId } = body;
    const headerTenantId = req.headers.get("x-tenant-id");
    const resolvedTenantId = tenantId || headerTenantId || undefined;

    if (!item_name || typeof price !== "number" || price <= 0) {
      return NextResponse.json({ error: "item_name و price مطلوبين (السعر يجب أن يكون أكبر من صفر)" }, { status: 400 });
    }

    const qty = quantity && quantity > 0 ? quantity : 1;
    const priceDecimal = new Decimal(price);
    const totalDecimal = priceDecimal.times(qty);
    const total = totalDecimal.toNumber();

    const paid = typeof paid_amount === "number" ? paid_amount : total;
    const deferredDecimal = Decimal.max(0, totalDecimal.minus(paid));
    const deferred = deferredDecimal.toNumber();

    const sale = await prisma.sale.create({
      data: {
        itemName: item_name.trim(),
        price,
        quantity: qty,
        total,
        customerName: customer_name ? customer_name.trim() : "عميل نقدي",
        paidAmount: paid,
        deferredAmount: deferred,
        ...(resolvedTenantId && { tenantId: resolvedTenantId }),
      },
    });

    return NextResponse.json({ success: true, sale, deferredAmount: deferred });
  } catch (err) {
    console.error("[Sales POST Error]", err);
    return NextResponse.json({ error: "حصل خطأ في تسجيل عملية البيع" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");

  const sales = await prisma.sale.findMany({
    where: {
      ...(tenantId && { tenantId }),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ sales });
}

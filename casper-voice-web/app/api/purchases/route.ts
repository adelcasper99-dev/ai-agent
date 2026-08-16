import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getResolvedTenantId, isInternalAuthValid } from "@/lib/auth";
import { calculatePurchaseTotals, parseMoney, Decimal } from "@/lib/financial";
import { runWithTenant } from "@/lib/prisma-tenant-extension";

// Simple in-memory idempotency cache (60 seconds)
const idempotencyMap = new Map<string, { timestamp: number; response: any }>();

export async function POST(req: NextRequest) {
  try {
    const resolvedTenantId = await getResolvedTenantId(req);
    if (!resolvedTenantId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { supplier_name, item_name, total_amount, paid_amount = 0, notes = "" } = body;

    const totalDec = parseMoney(total_amount);
    if (!supplier_name || !item_name || totalDec.isZero() || !totalDec.isPositive()) {
      return NextResponse.json(
        { error: "بيانات المشتريات غير مكتملة (اسم المورد + الصنف + المبلغ الإجمالي مطلوبين)" },
        { status: 400 }
      );
    }

    const financials = calculatePurchaseTotals(totalDec, paid_amount);

    // 1. Find or create Supplier by tenantId & name
    const supplierNameStr = supplier_name.trim();
    let supplier = await prisma.supplier.findFirst({
      where: { name: supplierNameStr, tenantId: resolvedTenantId },
    });
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: { name: supplierNameStr, tenantId: resolvedTenantId },
      });
    }

    // 2. Create Purchase record
    const purchase = await prisma.purchase.create({
      data: {
        supplierId: supplier.id,
        itemName: item_name.trim(),
        totalAmount: financials.totalAmountStr,
        paidAmount: financials.paidAmountStr,
        deferredAmount: financials.deferredAmountStr,
        notes: notes.trim(),
        tenantId: resolvedTenantId,
      },
    });

    return NextResponse.json({
      success: true,
      purchase,
      supplierName: supplier.name,
      deferredAmount: financials.deferredAmount.toNumber(),
      deferredAmountStr: financials.deferredAmountStr,
    });
  } catch (err) {
    console.error("[Purchases POST Error]", err);
    return NextResponse.json({ error: "حصل خطأ في تسجيل المشتريات" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const purchases = await prisma.purchase.findMany({
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ purchases });
  } catch (err) {
    console.error("[Purchases GET Error]", err);
    return NextResponse.json({ error: "حصل خطأ في جلب المشتريات" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!isInternalAuthValid(req)) {
      return NextResponse.json({ error: "غير مصرح (Unauthorized)" }, { status: 401 });
    }

    const resolvedTenantId = await getResolvedTenantId(req);
    if (!resolvedTenantId) {
      return NextResponse.json({ error: "غير مصرح (Missing Tenant ID)" }, { status: 401 });
    }

    return await runWithTenant(resolvedTenantId, async () => {
      // Idempotency check
      const idempotencyKey = req.headers.get("idempotency-key");
      const now = Date.now();
      if (idempotencyKey) {
        const cached = idempotencyMap.get(idempotencyKey);
        if (cached && now - cached.timestamp < 60000) {
          return NextResponse.json({ ...cached.response, cached: true });
        }
      }

      const { id, supplier_name, payment_amount, notes } = await req.json();

      if (!supplier_name && !id) {
        return NextResponse.json({ error: "يلزم تحديد اسم المورد أو المعرف (ID)" }, { status: 400 });
      }

      // Locate purchase record
      let purchaseRecord = null;
      if (id) {
        purchaseRecord = await prisma.purchase.findUnique({ where: { id }, include: { supplier: true } });
      } else {
        const supplier = await prisma.supplier.findFirst({
          where: { name: { contains: supplier_name.trim() } },
          include: {
            purchases: {
              where: { deferredAmount: { gt: 0 } },
              orderBy: { createdAt: "desc" },
            },
          },
        });

        if (!supplier || supplier.purchases.length === 0) {
          return NextResponse.json(
            { error: `عفواً، مفيش أي متبقي آجل مسجل للمورد (${supplier_name}) للتسديد.` },
            { status: 404 }
          );
        }
        purchaseRecord = supplier.purchases[0];
      }

      if (!purchaseRecord) {
        return NextResponse.json({ error: "سجل المشتريات غير موجود" }, { status: 404 });
      }

      const paymentDec = parseMoney(payment_amount);
      if (!paymentDec.isPositive() || paymentDec.isZero()) {
        return NextResponse.json({ error: "مبلغ السداد يجب أن يكون أكبر من الصفر" }, { status: 400 });
      }

      // ⚡ DECIMAL.JS Financial Math Guarantee
      const currentTotal = parseMoney(purchaseRecord.totalAmount.toString());
      const currentPaid = parseMoney(purchaseRecord.paidAmount.toString());
      const newPaidDecimal = currentPaid.plus(paymentDec);
      const newDeferredDecimal = Decimal.max(0, currentTotal.minus(newPaidDecimal));

      const updated = await prisma.purchase.update({
        where: { id: purchaseRecord.id },
        data: {
          paidAmount: newPaidDecimal.toFixed(2),
          deferredAmount: newDeferredDecimal.toFixed(2),
          ...(notes && { notes: notes.trim() }),
        },
      });

      const responsePayload = {
        success: true,
        supplierName: supplier_name || "المورد",
        paymentApplied: paymentDec.toNumber(),
        remainingDebt: newDeferredDecimal.toNumber(),
        remainingDebtStr: newDeferredDecimal.toFixed(2),
        updated,
      };

      if (idempotencyKey) {
        idempotencyMap.set(idempotencyKey, { timestamp: now, response: responsePayload });
      }

      return NextResponse.json(responsePayload);
    });
  } catch (err) {
    console.error("[Purchases PUT Error]", err);
    return NextResponse.json({ error: "حصل خطأ في تسديد مستحقات المورد" }, { status: 500 });
  }
}

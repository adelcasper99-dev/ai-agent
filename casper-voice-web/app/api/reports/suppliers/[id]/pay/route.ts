import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Decimal from "decimal.js";
import { z } from "zod";

const paySupplierSchema = z.object({
  amount: z.union([z.number(), z.string()]).refine((val) => {
    try {
      const d = new Decimal(val);
      return d.isPositive() && !d.isZero();
    } catch {
      return false;
    }
  }, "المبلغ يجب أن يكون رقماً موجباً أكبر من الصفر"),
  notes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = paySupplierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "مبلغ غير صالح" },
        { status: 400 }
      );
    }

    const paymentAmount = new Decimal(parsed.data.amount);
    const notes = parsed.data.notes?.trim() || "";

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: {
          where: { voided: false },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: "المورد غير موجود" },
        { status: 404 }
      );
    }

    const result = await (prisma as any).$transaction(async (tx: any) => {
      // 1. Record SupplierPayment entry
      const paymentRecord = await tx.supplierPayment.create({
        data: {
          supplierId: id,
          tenantId: supplier.tenantId,
          amount: paymentAmount.toString(),
          notes: notes,
        },
      });

      // 2. Reduce deferred amounts on outstanding purchases oldest-first
      let remainingPayment = new Decimal(paymentAmount);

      for (const purchase of supplier.purchases) {
        if (remainingPayment.isZero()) break;

        const currentDeferred = new Decimal(purchase.deferredAmount.toString());
        const currentPaid = new Decimal(purchase.paidAmount.toString());

        if (currentDeferred.greaterThan(0)) {
          const deduction = Decimal.min(remainingPayment, currentDeferred);
          const newDeferred = currentDeferred.minus(deduction);
          const newPaid = currentPaid.plus(deduction);
          remainingPayment = remainingPayment.minus(deduction);

          await tx.purchase.update({
            where: { id: purchase.id },
            data: {
              deferredAmount: newDeferred.toString(),
              paidAmount: newPaid.toString(),
            },
          });
        }
      }

      return paymentRecord;
    });

    return NextResponse.json({ success: true, payment: result });
  } catch (err: any) {
    console.error("[Pay Supplier Error]", err);
    return NextResponse.json(
      { error: err?.message || "فشل في تسجيل دفعة المورد" },
      { status: 500 }
    );
  }
}

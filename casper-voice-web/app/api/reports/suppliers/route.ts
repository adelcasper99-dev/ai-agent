import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { parseMoney, Decimal } from "@/lib/financial";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    const tenantId = searchParams.get("tenantId");

    const where: any = {};
    if (name) where.name = { contains: name };
    if (tenantId && tenantId !== "all") where.tenantId = tenantId;

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        purchases: {
          where: { voided: false },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute live total debt per supplier via sum of deferredAmount
    const suppliersWithDebt = suppliers.map((supplier) => {
      const totalDebt = supplier.purchases.reduce(
        (acc, p) => acc.plus(parseMoney(p.deferredAmount.toString())),
        new Decimal(0)
      );
      const totalPurchasesAmount = supplier.purchases.reduce(
        (acc, p) => acc.plus(parseMoney(p.totalAmount.toString())),
        new Decimal(0)
      );
      return {
        ...supplier,
        totalDebt: totalDebt.toNumber(),
        totalDebtStr: totalDebt.toFixed(2),
        totalPurchasesAmount: totalPurchasesAmount.toNumber(),
        totalPurchasesAmountStr: totalPurchasesAmount.toFixed(2),
      };
    });

    return NextResponse.json({ suppliers: suppliersWithDebt, count: suppliersWithDebt.length });
  } catch (err) {
    console.error("[Reports Suppliers Error]", err);
    return NextResponse.json({ error: "حصل خطأ في جلب بيانات الموردين" }, { status: 500 });
  }
}

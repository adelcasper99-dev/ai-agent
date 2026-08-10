import { prisma } from "@/lib/prisma";
// app/api/reports/suppliers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");

    const where = name ? { name: { contains: name } } : {};

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        purchases: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute live total debt per supplier via sum of deferredAmount
    const suppliersWithDebt = suppliers.map((supplier) => {
      const totalDebt = supplier.purchases.reduce((acc, p) => acc.plus(p.deferredAmount), new Prisma.Decimal(0));
      const totalPurchasesAmount = supplier.purchases.reduce((acc, p) => acc.plus(p.totalAmount), new Prisma.Decimal(0));
      return {
        ...supplier,
        totalDebt,
        totalPurchasesAmount,
      };
    });

    return NextResponse.json({ suppliers: suppliersWithDebt, count: suppliersWithDebt.length });
  } catch (err) {
    console.error("[Reports Suppliers Error]", err);
    return NextResponse.json({ error: "حصل خطأ في جلب بيانات الموردين" }, { status: 500 });
  }
}

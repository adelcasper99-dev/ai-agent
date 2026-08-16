import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMoney, Decimal } from "@/lib/financial";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId");

    const whereClause: any = {};
    if (tenantId && tenantId !== "all") {
      whereClause.tenantId = tenantId;
    }

    const now = new Date();
    const customers: any[] = [];
    let totalDueDec = new Decimal(0);
    let currentDec = new Decimal(0);
    let days30Dec = new Decimal(0);
    let days60Dec = new Decimal(0);
    let days90Dec = new Decimal(0);

    // Fetch customers with outstanding sales (deferredAmount > 0)
    const customersRaw = await prisma.customer.findMany({
      where: whereClause,
      include: {
        sales: {
          where: {
            deferredAmount: { gt: 0 },
            voided: false,
          },
          select: { id: true, createdAt: true, deferredAmount: true },
        },
      },
    });

    for (const c of customersRaw) {
      const sales = c.sales || [];
      if (sales.length === 0) continue;

      let cTotal = new Decimal(0);
      let cCurrent = new Decimal(0);
      let c30 = new Decimal(0);
      let c60 = new Decimal(0);
      let c90 = new Decimal(0);

      for (const s of sales) {
        const ageInDays = Math.floor((now.getTime() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const amt = parseMoney(s.deferredAmount.toString());

        cTotal = cTotal.plus(amt);
        if (ageInDays < 30) cCurrent = cCurrent.plus(amt);
        else if (ageInDays < 60) c30 = c30.plus(amt);
        else if (ageInDays < 90) c60 = c60.plus(amt);
        else c90 = c90.plus(amt);
      }

      if (cTotal.greaterThan(0)) {
        customers.push({
          id: c.id,
          name: c.name,
          phone: c.phone || "",
          totalDue: cTotal.toNumber(),
          current: cCurrent.toNumber(),
          days30: c30.toNumber(),
          days60: c60.toNumber(),
          days90: c90.toNumber(),
        });
        totalDueDec = totalDueDec.plus(cTotal);
        currentDec = currentDec.plus(cCurrent);
        days30Dec = days30Dec.plus(c30);
        days60Dec = days60Dec.plus(c60);
        days90Dec = days90Dec.plus(c90);
      }
    }

    customers.sort((a, b) => b.totalDue - a.totalDue);

    return NextResponse.json({
      customers,
      summary: {
        totalDue: totalDueDec.toNumber(),
        current: currentDec.toNumber(),
        days30: days30Dec.toNumber(),
        days60: days60Dec.toNumber(),
        days90: days90Dec.toNumber(),
        customerCount: customers.length,
      },
    });
  } catch (err) {
    console.error("[aged-receivables error]", err);
    return NextResponse.json({
      customers: [],
      summary: { totalDue: 0, current: 0, days30: 0, days60: 0, days90: 0, customerCount: 0 },
    });
  }
}

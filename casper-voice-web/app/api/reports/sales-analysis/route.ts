// app/api/reports/sales-analysis/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMoney, Decimal } from "@/lib/financial";

type GroupByOption = "product" | "customer";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const groupBy = (searchParams.get("groupBy") || "product") as GroupByOption;
    const tenantId = searchParams.get("tenantId");

    const where: any = { voided: false };
    if (tenantId && tenantId !== "all") {
      where.tenantId = tenantId;
    }

    const salesRaw = await prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const groupMap: Record<
      string,
      {
        name: string;
        quantity: number;
        revenueDec: Decimal;
        paidDec: Decimal;
        deferredDec: Decimal;
        transactionCount: number;
      }
    > = {};

    for (const sale of salesRaw) {
      let key = "";
      let name = "";

      if (groupBy === "customer") {
        key = sale.customerName?.trim() || "عميل نقدي";
        name = key;
      } else {
        // default: group by product / item name
        key = sale.itemName?.trim() || "غير محدد";
        name = key;
      }

      if (!groupMap[key]) {
        groupMap[key] = {
          name,
          quantity: 0,
          revenueDec: new Decimal(0),
          paidDec: new Decimal(0),
          deferredDec: new Decimal(0),
          transactionCount: 0,
        };
      }

      const itemTotal = parseMoney(sale.total.toString());
      const itemPaid = parseMoney(sale.paidAmount.toString());
      const itemDeferred = parseMoney(sale.deferredAmount.toString());

      groupMap[key].quantity += sale.quantity || 1;
      groupMap[key].revenueDec = groupMap[key].revenueDec.plus(itemTotal);
      groupMap[key].paidDec = groupMap[key].paidDec.plus(itemPaid);
      groupMap[key].deferredDec = groupMap[key].deferredDec.plus(itemDeferred);
      groupMap[key].transactionCount += 1;
    }

    const results = Object.values(groupMap)
      .map((g) => ({
        name: g.name,
        quantity: g.quantity,
        revenue: g.revenueDec.toNumber(),
        paidAmount: g.paidDec.toNumber(),
        deferredAmount: g.deferredDec.toNumber(),
        transactionCount: g.transactionCount,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    let totalRevenueDec = new Decimal(0);
    let totalPaidDec = new Decimal(0);
    let totalDeferredDec = new Decimal(0);
    let totalQuantity = 0;

    for (const g of Object.values(groupMap)) {
      totalRevenueDec = totalRevenueDec.plus(g.revenueDec);
      totalPaidDec = totalPaidDec.plus(g.paidDec);
      totalDeferredDec = totalDeferredDec.plus(g.deferredDec);
      totalQuantity += g.quantity;
    }

    return NextResponse.json({
      results,
      summary: {
        totalRevenue: totalRevenueDec.toNumber(),
        totalPaid: totalPaidDec.toNumber(),
        totalDeferred: totalDeferredDec.toNumber(),
        totalSalesCount: salesRaw.length,
        totalQuantity,
      },
    });
  } catch (err) {
    console.error("[sales-analysis error]", err);
    return NextResponse.json({
      results: [],
      summary: { totalRevenue: 0, totalPaid: 0, totalDeferred: 0, totalSalesCount: 0, totalQuantity: 0 },
    });
  }
}

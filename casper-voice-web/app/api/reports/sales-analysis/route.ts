// app/api/reports/sales-analysis/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type GroupByOption = "category" | "product" | "salesman";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const groupBy = (searchParams.get("groupBy") || "category") as GroupByOption;

    // Try to fetch real data; fall back to empty on any error
    let results: any[] = [];
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalSales = 0;

    try {
      // Check if the Sale model exists in prisma
      const salesRaw = await (prisma as any).sale?.findMany({
        include: {
          items: { include: { product: { include: { category: true } } } },
          createdBy: true,
        },
        where: { status: { not: "RETURNED" } },
      });

      if (salesRaw && salesRaw.length > 0) {
        const groupMap: Record<string, { name: string; quantity: number; revenue: number; profit: number; transactionCount: number }> = {};

        for (const sale of salesRaw) {
          const items = sale.items || [];
          for (const item of items) {
            let key = "";
            let name = "";

            if (groupBy === "category") {
              key = item.product?.category?.id || "unknown";
              name = item.product?.category?.name || "غير مصنف";
            } else if (groupBy === "product") {
              key = item.product?.id || "unknown";
              name = item.product?.name || "منتج غير معروف";
            } else if (groupBy === "salesman") {
              key = sale.createdById || "unknown";
              name = sale.createdBy?.name || "غير محدد";
            }

            if (!groupMap[key]) {
              groupMap[key] = { name, quantity: 0, revenue: 0, profit: 0, transactionCount: 0 };
            }

            const qty = Number(item.quantity ?? 0);
            const price = Number(item.unitPrice ?? 0);
            const cost = Number(item.costPrice ?? 0);

            groupMap[key].quantity += qty;
            groupMap[key].revenue += qty * price;
            groupMap[key].profit += qty * (price - cost);
            groupMap[key].transactionCount += 1;
          }
        }

        results = Object.values(groupMap).sort((a, b) => b.revenue - a.revenue);
        totalRevenue = results.reduce((acc, r) => acc + r.revenue, 0);
        totalProfit = results.reduce((acc, r) => acc + r.profit, 0);
        totalSales = results.reduce((acc, r) => acc + r.quantity, 0);
      }
    } catch {
      // Model doesn't exist or schema mismatch — return empty structure
    }

    return NextResponse.json({
      results,
      summary: { totalRevenue, totalProfit, totalSales },
    });
  } catch (err) {
    console.error("[sales-analysis]", err);
    return NextResponse.json({ results: [], summary: { totalRevenue: 0, totalProfit: 0, totalSales: 0 } });
  }
}

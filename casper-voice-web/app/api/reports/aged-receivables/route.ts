import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    let totalDue = 0, current = 0, days30 = 0, days60 = 0, days90 = 0;

    try {
      // Try fetching from Customer model with outstanding invoices
      const customersRaw = await (prisma as any).customer?.findMany({
        where: whereClause,
        include: {
          sales: {
            where: { remainingAmount: { gt: 0 } },
            select: { id: true, createdAt: true, remainingAmount: true },
          },
        },
      });

      if (customersRaw) {
        for (const c of customersRaw) {
          const sales = c.sales || [];
          if (sales.length === 0) continue;

          let cTotal = 0, cCurrent = 0, c30 = 0, c60 = 0, c90 = 0;

          for (const s of sales) {
            const age = Math.floor((now.getTime() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24));
            const amt = Number(s.remainingAmount ?? 0);
            cTotal += amt;
            if (age < 30) cCurrent += amt;
            else if (age < 60) c30 += amt;
            else if (age < 90) c60 += amt;
            else c90 += amt;
          }

          if (cTotal > 0) {
            customers.push({
              id: c.id,
              name: c.name,
              phone: c.phone,
              totalDue: cTotal,
              current: cCurrent,
              days30: c30,
              days60: c60,
              days90: c90,
            });
            totalDue += cTotal;
            current += cCurrent;
            days30 += c30;
            days60 += c60;
            days90 += c90;
          }
        }
        customers.sort((a, b) => b.totalDue - a.totalDue);
      }
    } catch {
      // Model mismatch — return empty
    }

    return NextResponse.json({
      customers,
      summary: { totalDue, current, days30, days60, days90, customerCount: customers.length },
    });
  } catch (err) {
    console.error("[aged-receivables]", err);
    return NextResponse.json({
      customers: [],
      summary: { totalDue: 0, current: 0, days30: 0, days60: 0, days90: 0, customerCount: 0 },
    });
  }
}

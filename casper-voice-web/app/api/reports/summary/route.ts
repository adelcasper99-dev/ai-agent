import { prisma } from "@/lib/prisma";
// app/api/reports/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "today";

    let dateFilter: { gte?: Date } = {};
    const now = new Date();

    if (period === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { gte: startOfDay };
    } else if (period === "week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      dateFilter = { gte: startOfWeek };
    } else if (period === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { gte: startOfMonth };
    }

    const whereClause = dateFilter.gte ? { createdAt: dateFilter } : {};

    // 1. Sales
    const sales = await prisma.sale.findMany({ where: whereClause });
    const totalSales = sales.reduce((acc, s) => acc.plus(s.total), new Prisma.Decimal(0));
    const totalPaidSales = sales.reduce((acc, s) => acc.plus(s.paidAmount), new Prisma.Decimal(0));
    const totalCustomerCredit = sales.reduce((acc, s) => acc.plus(s.deferredAmount), new Prisma.Decimal(0));

    // 2. Expenses
    const expenses = await prisma.expense.findMany({ where: whereClause });
    const totalExpenses = expenses.reduce((acc, e) => acc.plus(e.amount), new Prisma.Decimal(0));

    // 3. Purchases
    const purchases = await prisma.purchase.findMany({ where: whereClause });
    const totalPurchases = purchases.reduce((acc, p) => acc.plus(p.totalAmount), new Prisma.Decimal(0));
    const totalPaidPurchases = purchases.reduce((acc, p) => acc.plus(p.paidAmount), new Prisma.Decimal(0));
    const totalSupplierDebt = purchases.reduce((acc, p) => acc.plus(p.deferredAmount), new Prisma.Decimal(0));

    // 4. Net Profit
    const netProfit = totalSales.minus(totalExpenses).minus(totalPurchases);

    return NextResponse.json({
      period,
      summary: {
        totalSales,
        totalPaidSales,
        totalCustomerCredit,
        totalExpenses,
        totalPurchases,
        totalPaidPurchases,
        totalSupplierDebt,
        netProfit,
        salesCount: sales.length,
        expensesCount: expenses.length,
        purchasesCount: purchases.length,
      },
    });
  } catch (err) {
    console.error("[Reports Summary Error]", err);
    return NextResponse.json({ error: "حصل خطأ في جلب التقارير" }, { status: 500 });
  }
}

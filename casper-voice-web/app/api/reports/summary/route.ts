import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { parseMoney, calculateNetProfit, Decimal } from "@/lib/financial";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "today";
    const tenantId = searchParams.get("tenantId");

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

    const whereClause: any = { voided: false };
    if (dateFilter.gte) {
      whereClause.createdAt = dateFilter;
    }
    if (tenantId && tenantId !== "all") {
      whereClause.tenantId = tenantId;
    }

    // 1. Sales
    const sales = await prisma.sale.findMany({ where: whereClause });
    const totalSales = sales.reduce((acc, s) => acc.plus(parseMoney(s.total.toString())), new Decimal(0));
    const totalPaidSales = sales.reduce((acc, s) => acc.plus(parseMoney(s.paidAmount.toString())), new Decimal(0));
    const totalCustomerCredit = sales.reduce((acc, s) => acc.plus(parseMoney(s.deferredAmount.toString())), new Decimal(0));

    // 2. Expenses
    const expenses = await prisma.expense.findMany({ where: whereClause });
    const totalExpenses = expenses.reduce((acc, e) => acc.plus(parseMoney(e.amount.toString())), new Decimal(0));

    // 3. Purchases
    const purchases = await prisma.purchase.findMany({ where: whereClause });
    const totalPurchases = purchases.reduce((acc, p) => acc.plus(parseMoney(p.totalAmount.toString())), new Decimal(0));
    const totalPaidPurchases = purchases.reduce((acc, p) => acc.plus(parseMoney(p.paidAmount.toString())), new Decimal(0));
    const totalSupplierDebt = purchases.reduce((acc, p) => acc.plus(parseMoney(p.deferredAmount.toString())), new Decimal(0));

    // 4. Net Profit
    const netProfit = calculateNetProfit(totalSales, totalExpenses, totalPurchases);

    return NextResponse.json({
      period,
      summary: {
        totalSales: totalSales.toNumber(),
        totalSalesStr: totalSales.toFixed(2),
        totalPaidSales: totalPaidSales.toNumber(),
        totalCustomerCredit: totalCustomerCredit.toNumber(),
        totalExpenses: totalExpenses.toNumber(),
        totalExpensesStr: totalExpenses.toFixed(2),
        totalPurchases: totalPurchases.toNumber(),
        totalPurchasesStr: totalPurchases.toFixed(2),
        totalPaidPurchases: totalPaidPurchases.toNumber(),
        totalSupplierDebt: totalSupplierDebt.toNumber(),
        netProfit: netProfit.toNumber(),
        netProfitStr: netProfit.toFixed(2),
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

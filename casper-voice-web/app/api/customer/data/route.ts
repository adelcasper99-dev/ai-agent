import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCustomerSession } from "@/lib/session";
import Decimal from "decimal.js";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("customer_session")?.value;
    if (!token) {
      return NextResponse.json({ error: "غير مصرح - يرجى تسجيل الدخول" }, { status: 401 });
    }

    const customerId = await verifyCustomerSession(token);
    if (!customerId) {
      return NextResponse.json({ error: "جلسة غير صالحة أو منتهية" }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        appointments: {
          orderBy: { date: "desc" },
          take: 20,
        },
        sales: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        ledgers: {
          orderBy: { createdAt: "desc" },
          take: 30,
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "بيانات العميل غير موجودة" }, { status: 404 });
    }

    // Financial balance calculation using Decimal.js
    let totalPurchases = new Decimal(0);
    for (const s of customer.sales) {
      totalPurchases = totalPurchases.plus(new Decimal(s.total?.toString() || 0));
    }

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const entry of customer.ledgers) {
      const amt = new Decimal(entry.amount?.toString() || 0);
      if (entry.entryType === "SALE_DEBIT") {
        totalDebit = totalDebit.plus(amt);
      } else if (entry.entryType === "PAYMENT_CREDIT") {
        totalCredit = totalCredit.plus(amt);
      }
    }

    const outstandingBalance = totalDebit.minus(totalCredit);

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
      },
      stats: {
        totalPurchases: totalPurchases.toFixed(2),
        totalDebit: totalDebit.toFixed(2),
        totalCredit: totalCredit.toFixed(2),
        outstandingBalance: outstandingBalance.toFixed(2),
        appointmentsCount: customer.appointments.length,
        salesCount: customer.sales.length,
      },
      appointments: customer.appointments,
      sales: customer.sales,
      ledgers: customer.ledgers,
    });
  } catch (err: any) {
    console.error("[Customer Data Error]", err);
    return NextResponse.json({ error: "فشل في جلب بيانات العميل" }, { status: 500 });
  }
}

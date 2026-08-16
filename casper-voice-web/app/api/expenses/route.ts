import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getResolvedTenantId, isInternalAuthValid } from "@/lib/auth";
import { parseMoney } from "@/lib/financial";
import { runWithTenant } from "@/lib/prisma-tenant-extension";

export async function POST(req: NextRequest) {
  try {
    const resolvedTenantId = await getResolvedTenantId(req);
    if (!resolvedTenantId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { amount, description, category } = body;

    const amountDec = parseMoney(amount);
    if (!description || !description.trim() || !amountDec.isPositive() || amountDec.isZero()) {
      return NextResponse.json({ error: "amount و description مطلوبين (المبلغ يجب أن يكون أكبر من صفر)" }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        amount: amountDec.toFixed(2),
        description: description.trim(),
        category: (category && category.trim()) || "عام",
        tenantId: resolvedTenantId,
      },
    });

    return NextResponse.json({ success: true, expense });
  } catch (err) {
    console.error("[Expenses POST Error]", err);
    return NextResponse.json({ error: "حصل خطأ في السيرفر" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const sessionTenantId = await getResolvedTenantId(req);
  const queryTenantId = req.nextUrl.searchParams.get("tenantId");

  const effectiveTenantId = queryTenantId ?? sessionTenantId;
  const where: any = {};
  if (effectiveTenantId && effectiveTenantId !== "all") {
    where.tenantId = effectiveTenantId;
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ expenses });
}

export async function PUT(req: NextRequest) {
  try {
    if (!isInternalAuthValid(req)) {
      return NextResponse.json({ error: "غير مصرح (Unauthorized)" }, { status: 401 });
    }
    const resolvedTenantId = await getResolvedTenantId(req);
    if (!resolvedTenantId) {
      return NextResponse.json({ error: "غير مصرح (Missing Tenant ID)" }, { status: 401 });
    }

    return await runWithTenant(resolvedTenantId, async () => {
      const { id, description, new_amount, new_description, category } = await req.json();

      if (id) {
        const existing = await prisma.expense.findUnique({ where: { id } });
        if (!existing) {
          return NextResponse.json({ error: "المصروف غير موجود" }, { status: 404 });
        }

        const updateData: any = {};
        if (new_amount !== undefined && new_amount !== null) {
          const amtDec = parseMoney(new_amount);
          if (amtDec.isPositive() && !amtDec.isZero()) {
            updateData.amount = amtDec.toFixed(2);
          }
        }
        if (new_description && new_description.trim()) {
          updateData.description = new_description.trim();
        }
        if (category && category.trim()) {
          updateData.category = category.trim();
        }

        const updated = await prisma.expense.update({
          where: { id },
          data: updateData,
        });

        return NextResponse.json({
          success: true,
          oldAmount: existing.amount,
          newAmount: updated.amount,
          updated,
        });
      }

      if (!description) {
        return NextResponse.json({ error: "يلزم الوصف (description) لتحديد المصروف المراد تعديله" }, { status: 400 });
      }

      // Find latest matching expense by description
      const latestExpense = await prisma.expense.findFirst({
        where: { description: { contains: description.trim() } },
        orderBy: { createdAt: "desc" },
      });

      if (!latestExpense) {
        return NextResponse.json(
          { error: `عفواً، مفيش أي مصروف مسجل بوصف (${description}) للتعديل.` },
          { status: 404 }
        );
      }

      const updateData: any = {};
      if (new_amount !== undefined && new_amount !== null) {
        const amtDec = parseMoney(new_amount);
        if (amtDec.isPositive() && !amtDec.isZero()) {
          updateData.amount = amtDec.toFixed(2);
        }
      }
      if (new_description && new_description.trim()) {
        updateData.description = new_description.trim();
      }
      if (category && category.trim()) {
        updateData.category = category.trim();
      }

      const updated = await prisma.expense.update({
        where: { id: latestExpense.id },
        data: updateData,
      });

      return NextResponse.json({
        success: true,
        oldAmount: latestExpense.amount,
        newAmount: updated.amount,
        updated,
      });
    });
  } catch (err) {
    console.error("[Expenses PUT Error]", err);
    return NextResponse.json({ error: "حصل خطأ في تعديل المصروف" }, { status: 500 });
  }
}

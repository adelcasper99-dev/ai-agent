// app/api/expenses/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isInternalAuthValid } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, description, category, tenantId } = body;
    const headerTenantId = req.headers.get("x-tenant-id");
    const resolvedTenantId = tenantId || headerTenantId || undefined;

    if (typeof amount !== "number" || !description) {
      return NextResponse.json({ error: "amount و description مطلوبين" }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        amount,
        description,
        category: category || "عام",
        ...(resolvedTenantId && { tenantId: resolvedTenantId }),
      },
    });

    return NextResponse.json({ success: true, expense });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "حصل خطأ في السيرفر" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");

  const expenses = await prisma.expense.findMany({
    where: {
      ...(tenantId && { tenantId }),
    },
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

    const { id, description, new_amount, new_description, category } = await req.json();

    if (id) {
      const existing = await prisma.expense.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "المصروف غير موجود" }, { status: 404 });
      }
      const updated = await prisma.expense.update({
        where: { id },
        data: {
          ...(typeof new_amount === "number" && { amount: new_amount }),
          ...(new_description && { description: new_description.trim() }),
          ...(category && { category: category.trim() }),
        },
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

    const updated = await prisma.expense.update({
      where: { id: latestExpense.id },
      data: {
        ...(typeof new_amount === "number" && { amount: new_amount }),
        ...(new_description && { description: new_description.trim() }),
        ...(category && { category: category.trim() }),
      },
    });

    return NextResponse.json({
      success: true,
      oldAmount: latestExpense.amount,
      newAmount: updated.amount,
      updated,
    });
  } catch (err) {
    console.error("[Expenses PUT Error]", err);
    return NextResponse.json({ error: "حصل خطأ في تعديل المصروف" }, { status: 500 });
  }
}


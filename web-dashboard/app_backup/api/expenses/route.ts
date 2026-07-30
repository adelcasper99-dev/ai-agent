// app/api/expenses/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { amount, description, category } = await req.json();

    if (typeof amount !== "number" || !description) {
      return NextResponse.json({ error: "amount و description مطلوبين" }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: { amount, description, category: category || "عام" },
    });

    return NextResponse.json({ success: true, expense });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "حصل خطأ في السيرفر" }, { status: 500 });
  }
}

export async function GET() {
  const expenses = await prisma.expense.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ expenses });
}

// app/api/sales/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { item_name, price, quantity } = await req.json();

    if (!item_name || typeof price !== "number") {
      return NextResponse.json({ error: "item_name و price مطلوبين" }, { status: 400 });
    }

    const qty = quantity && quantity > 0 ? quantity : 1;

    const sale = await prisma.sale.create({
      data: {
        itemName: item_name,
        price,
        quantity: qty,
        total: price * qty,
      },
    });

    return NextResponse.json({ success: true, sale });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "حصل خطأ في السيرفر" }, { status: 500 });
  }
}

export async function GET() {
  const sales = await prisma.sale.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ sales });
}

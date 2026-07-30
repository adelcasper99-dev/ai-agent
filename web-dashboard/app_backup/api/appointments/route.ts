// app/api/appointments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { customer_name, date, time, notes } = await req.json();

    if (!customer_name || !date || !time) {
      return NextResponse.json(
        { error: "customer_name و date و time مطلوبين" },
        { status: 400 }
      );
    }

    const appointment = await prisma.appointment.create({
      data: { customerName: customer_name, date, time, notes: notes || "" },
    });

    return NextResponse.json({ success: true, appointment });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "حصل خطأ في السيرفر" }, { status: 500 });
  }
}

export async function GET() {
  const appointments = await prisma.appointment.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ appointments });
}

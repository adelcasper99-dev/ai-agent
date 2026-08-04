import { prisma } from "@/lib/prisma";
// app/api/reports/appointments/route.ts
import { NextRequest, NextResponse } from "next/server";


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const name = searchParams.get("name");

    const where: any = {};
    if (date) {
      where.date = { contains: date };
    }
    if (name) {
      where.customerName = { contains: name };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ appointments, count: appointments.length });
  } catch (err) {
    console.error("[Reports Appointments Error]", err);
    return NextResponse.json({ error: "حصل خطأ في جلب المواعيد" }, { status: 500 });
  }
}

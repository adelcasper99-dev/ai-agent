// app/api/tenants/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ tenants });
  } catch (err) {
    console.error("[GET /api/tenants/list Error]:", err);
    return NextResponse.json({ error: "حصل خطأ في جلب قائمة الشركات" }, { status: 500 });
  }
}

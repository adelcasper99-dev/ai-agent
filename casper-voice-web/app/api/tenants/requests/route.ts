import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    let requests: any[] = [];
    if ((prisma as any).pendingTenantRequest) {
      requests = await (prisma as any).pendingTenantRequest.findMany({
        orderBy: { requestedAt: "desc" },
      });
    } else {
      requests = await prisma.$queryRaw`
        SELECT * FROM "PendingTenantRequest"
        ORDER BY "requestedAt" DESC
      `;
    }

    return NextResponse.json({ success: true, requests });
  } catch (err: any) {
    console.error("[GET /api/tenants/requests error]", err);
    return NextResponse.json({ error: "فشل جلب طلبات التسجيل", detail: err.message }, { status: 500 });
  }
}

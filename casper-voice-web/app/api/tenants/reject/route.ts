// app/api/tenants/reject/route.ts
import { NextRequest, NextResponse } from "next/server";
import { rejectTenantRequest } from "@/lib/telegram";
import { isInternalAuthValid } from "@/lib/auth";
import { verifyAdminSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("admin_session")?.value;
    const isCookieAuthorized = Boolean(sessionCookie) && (await verifyAdminSession(sessionCookie!));
    const isServiceAuthorized = isInternalAuthValid(req);

    if (!isCookieAuthorized && !isServiceAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId } = await req.json();
    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }

    const result = await rejectTenantRequest(requestId, "dashboard:admin");
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[Dashboard Reject Tenant Error]", err);
    return NextResponse.json({ error: "Failed to reject tenant request" }, { status: 500 });
  }
}

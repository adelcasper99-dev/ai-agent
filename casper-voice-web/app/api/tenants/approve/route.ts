// app/api/tenants/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { approveTenantRequest } from "@/lib/telegram";
import { isInternalAuthValid } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("admin_session")?.value;
    const isAuthorized = Boolean(sessionCookie) || isInternalAuthValid(req);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId } = await req.json();
    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }

    const result = await approveTenantRequest(requestId, "dashboard:admin");
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[Dashboard Approve Tenant Error]", err);
    return NextResponse.json({ error: "Failed to approve tenant request" }, { status: 500 });
  }
}

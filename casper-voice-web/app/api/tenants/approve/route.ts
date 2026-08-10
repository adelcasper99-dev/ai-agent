// app/api/tenants/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { approveTenantRequest } from "@/lib/telegram";
import { isInternalAuthValid } from "@/lib/auth";
import { verifyAdminSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("admin_session")?.value;
    const isAuthorized =
      (Boolean(sessionCookie) && (await verifyAdminSession(sessionCookie!))) ||
      isInternalAuthValid(req);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId, subscriptionPlan } = await req.json();
    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }

    let expiresAt = undefined;
    if (subscriptionPlan === 'trial_14') {
      expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    } else if (subscriptionPlan === 'month_1') {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else if (subscriptionPlan === 'year_1') {
      expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    }

    const result = await approveTenantRequest(requestId, "dashboard:admin", subscriptionPlan || 'trial_14', expiresAt);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[Dashboard Approve Tenant Error]", err);
    return NextResponse.json({ error: "Failed to approve tenant request" }, { status: 500 });
  }
}

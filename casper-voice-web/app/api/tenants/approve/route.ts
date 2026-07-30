// app/api/tenants/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { approveTenantRequest } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    // Session Auth Guard (simulated/matched against admin token or session header)
    const authHeader = req.headers.get("authorization") || req.headers.get("x-admin-session");
    const adminSecret = process.env.ADMIN_SESSION_SECRET || "casper-admin-secret-key";

    if (!authHeader || (authHeader !== adminSecret && !authHeader.includes("Bearer"))) {
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

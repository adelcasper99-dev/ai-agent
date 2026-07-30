// app/api/tenants/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { approveTenantRequest } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("x-admin-session") || req.headers.get("x-internal-secret");
    const sessionCookie = req.cookies.get("admin_session")?.value;
    const adminSecret = process.env.ADMIN_SESSION_SECRET || "casper-admin-secret-key";

    if (!sessionCookie && (!authHeader || (authHeader !== adminSecret && authHeader !== "casper-voice-internal-secret-9988776655" && !authHeader.includes("Bearer")))) {
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

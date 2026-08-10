import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isInternalAuthValid } from "@/lib/auth";
import { verifyAdminSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("admin_session")?.value;
    const isAuthorized =
      (Boolean(sessionCookie) && verifyAdminSession(sessionCookie!)) ||
      isInternalAuthValid(req);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, tenantId, ...data } = body;

    if (!tenantId || !action) {
      return NextResponse.json({ error: "tenantId and action are required" }, { status: 400 });
    }

    // 1. Handle delete_request (for PendingTenantRequest records)
    if (action === "delete_request") {
      const pendingReq = await (prisma as any).pendingTenantRequest.findUnique({ where: { id: tenantId } });
      const chatId = pendingReq?.telegramChatId;

      await (prisma as any).pendingTenantRequest.deleteMany({
        where: { id: tenantId }
      });

      if (chatId) {
        await prisma.tenant.deleteMany({
          where: { telegramChatId: chatId }
        });
      }
      return NextResponse.json({ success: true, message: "Request and associated tenant deleted" });
    }

    // 2. Lookup Tenant record
    let tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    
    // Fallback: if tenantId is actually a PendingTenantRequest ID
    if (!tenant) {
      const pendingReq = await (prisma as any).pendingTenantRequest.findUnique({ where: { id: tenantId } });
      if (pendingReq?.telegramChatId) {
        tenant = await prisma.tenant.findUnique({ where: { telegramChatId: pendingReq.telegramChatId } });
      }
    }

    if (!tenant && action !== "delete") {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (action === "suspend" && tenant) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { state: "suspended" },
      });
      return NextResponse.json({ success: true, message: "Tenant suspended" });
    }

    if (action === "reactivate" && tenant) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { state: "active" },
      });
      return NextResponse.json({ success: true, message: "Tenant reactivated" });
    }

    if (action === "extend_plan" && tenant) {
      const { subscriptionPlan } = data;
      let expiresAt = tenant.expiresAt;
      
      const now = Date.now();
      const baseDate = (expiresAt && expiresAt.getTime() > now) ? expiresAt.getTime() : now;

      if (subscriptionPlan === 'trial_14') {
        expiresAt = new Date(baseDate + 14 * 24 * 60 * 60 * 1000);
      } else if (subscriptionPlan === 'month_1') {
        expiresAt = new Date(baseDate + 30 * 24 * 60 * 60 * 1000);
      } else if (subscriptionPlan === 'year_1') {
        expiresAt = new Date(baseDate + 365 * 24 * 60 * 60 * 1000);
      } else if (subscriptionPlan === 'custom' && data.expiresAt) {
        expiresAt = new Date(data.expiresAt);
      }

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { subscriptionPlan, expiresAt, state: "active" },
      });
      return NextResponse.json({ success: true, message: "Plan extended", expiresAt });
    }

    if (action === "edit_details" && tenant) {
      const { name, phoneNumber } = data;
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { name, phoneNumber },
      });
      return NextResponse.json({ success: true, message: "Details updated" });
    }

    if (action === "delete") {
      if (tenant) {
        const chatId = tenant.telegramChatId;
        await (prisma as any).tenant.update({
          where: { id: tenant.id },
          data: {
            state: "deleted",
            telegramChatId: null,
            ownerTelegramUserId: null,
            businessConnectionId: null,
            businessConnectionActive: false,
          },
        });
        if (chatId) {
          await (prisma as any).pendingTenantRequest.deleteMany({
            where: { telegramChatId: chatId },
          });
        }
      } else {
        await (prisma as any).pendingTenantRequest.deleteMany({
          where: { id: tenantId },
        });
      }
      return NextResponse.json({ success: true, message: "Tenant soft deleted and unlinked successfully" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[POST /api/tenants/manage error]", err);
    return NextResponse.json({ error: "Internal Server Error", detail: err.message }, { status: 500 });
  }
}

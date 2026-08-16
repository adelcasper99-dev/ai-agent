import { NextRequest, NextResponse } from "next/server";
import { prismaSystem } from "@/lib/prisma";
import { verifyAdminSessionRaw, verifyTenantSessionRaw, extractSessionDetails } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const adminCookie = req.cookies.get("admin_session")?.value;
    const tenantCookie = req.cookies.get("tenant_session")?.value;
    const customerCookie = req.cookies.get("customer_session")?.value;

    let role: "admin" | "tenant" | "customer" | "guest" = "guest";
    let tenantId: string | undefined;
    let sessionDetails: any = null;

    if (adminCookie) {
      const verified = await verifyAdminSessionRaw(adminCookie);
      if (verified) {
        role = "admin";
        sessionDetails = await extractSessionDetails(adminCookie);
      }
    }

    if (tenantCookie) {
      const verifiedTenantId = await verifyTenantSessionRaw(tenantCookie);
      if (verifiedTenantId) {
        tenantId = verifiedTenantId;
        if (role === "guest") {
          role = "tenant";
          sessionDetails = await extractSessionDetails(tenantCookie);
        }
      }
    }

    if (role === "guest") {
      return NextResponse.json({
        isAuthenticated: false,
        user: null,
        tenant: null,
      });
    }

    // Fetch tenant details from database
    let tenantInfo = null;
    if (tenantId) {
      tenantInfo = await prismaSystem.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          state: true,
          createdAt: true,
        },
      });
    }

    // If admin has no specific tenant attached yet, pick the first active tenant
    if (!tenantInfo && role === "admin") {
      tenantInfo = await prismaSystem.tenant.findFirst({
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          state: true,
          createdAt: true,
        },
      });
    }

    const initials = role === "admin" ? "G" : (tenantInfo?.name ? tenantInfo.name.charAt(0).toUpperCase() : "C");

    return NextResponse.json({
      isAuthenticated: true,
      user: {
        name: role === "admin" ? "المدير العام" : (tenantInfo?.name || "المستخدم"),
        role: role === "admin" ? "Super Admin" : "مدير الفرع",
        roleLabel: role === "admin" ? "مدير النظام الرئيسي" : "مشرف النظام",
        email: role === "admin" ? "admin@casper.pos" : "user@casper.pos",
        initials,
      },
      tenant: tenantInfo ? {
        id: tenantInfo.id,
        name: tenantInfo.name,
        phoneNumber: tenantInfo.phoneNumber,
        state: tenantInfo.state,
      } : {
        id: "default-tenant",
        name: "شركة كاسبر الرئيسية",
        phoneNumber: "01000000000",
        state: "active",
      },
      session: {
        role,
        issuedAt: sessionDetails?.issuedAt ? new Date(sessionDetails.issuedAt * 1000).toISOString() : new Date().toISOString(),
        expiresAt: sessionDetails?.expiresAt ? new Date(sessionDetails.expiresAt * 1000).toISOString() : null,
      },
    });
  } catch (error: any) {
    console.error("[GET /api/auth/me Error]:", error);
    return NextResponse.json(
      { error: "Failed to fetch session identity", details: error.message },
      { status: 500 }
    );
  }
}

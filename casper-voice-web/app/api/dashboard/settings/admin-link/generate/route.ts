import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResolvedTenantId, isInternalAuthValid } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // 1. Server-derived session authentication (fail closed if ADMIN_KEY is unset)
    const tenantIdFromSession = await getResolvedTenantId(req);
    const adminKey = process.env.ADMIN_KEY;
    const isSuperAdmin = isInternalAuthValid(req) || (Boolean(adminKey) && req.headers.get("x-admin-key") === adminKey);

    let scope = "GLOBAL";
    let targetTenantId: string | null = null;

    if (isSuperAdmin) {
      scope = "GLOBAL";
      targetTenantId = null;
    } else if (tenantIdFromSession) {
      scope = "TENANT";
      targetTenantId = tenantIdFromSession;
    } else {
      return NextResponse.json(
        { error: "Unauthorized — missing or invalid admin session" },
        { status: 403 }
      );
    }

    // 2. Invalidate previous unused, unexpired tokens for the same scope and tenantId
    await prisma.adminLinkToken.updateMany({
      where: {
        scope,
        tenantId: targetTenantId,
        used: false,
        expiresAt: { gt: new Date() },
      },
      data: { used: true },
    });

    // 3. Generate unique 4-digit code (retry loop up to 5 times on collision)
    let code = "";
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      code = Math.floor(1000 + Math.random() * 9000).toString();
      const existing = await prisma.adminLinkToken.findFirst({
        where: {
          code,
          used: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!existing) break;
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: "Failed to generate unique linking code. Please try again." },
        { status: 500 }
      );
    }

    // 4. Save new AdminLinkToken with 5-minute TTL
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const token = await prisma.adminLinkToken.create({
      data: {
        scope,
        tenantId: targetTenantId,
        code,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      code: token.code,
      scope: token.scope,
      tenantId: token.tenantId,
      expiresAt: token.expiresAt.toISOString(),
    });
  } catch (err: any) {
    console.error("[admin-link-generate] Error generating link token:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

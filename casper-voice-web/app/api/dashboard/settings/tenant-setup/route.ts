import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResolvedTenantId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getResolvedTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        setupCode: true,
        businessConnectionActive: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Attempt to grab the bot username from env (fallback to Casperaibot)
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "Casperaibot";

    return NextResponse.json({
      success: true,
      setupCode: tenant.setupCode,
      businessConnectionActive: tenant.businessConnectionActive,
      botUsername,
    });
  } catch (err: any) {
    console.error("[tenant-setup GET error]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getResolvedTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate a unique 6-character alphanumeric code
    const generateCode = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let newCode = "";
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      newCode = generateCode();
      const existing = await prisma.tenant.findUnique({
        where: { setupCode: newCode },
      });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return NextResponse.json({ error: "Failed to generate unique code" }, { status: 500 });
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { setupCode: newCode },
    });

    return NextResponse.json({
      success: true,
      setupCode: newCode,
    });
  } catch (err: any) {
    console.error("[tenant-setup POST error]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

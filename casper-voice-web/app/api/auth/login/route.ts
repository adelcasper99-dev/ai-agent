import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { signTenantSession, signAdminSession } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(ip, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "كثرة المحاولات. حاول بعد 15 دقيقة." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const { password } = await request.json();

  if (password === process.env.ADMIN_PASSWORD) {
    let pilotTenantId = process.env.PILOT_TENANT_ID;
    let tenant = null;

    if (pilotTenantId) {
      tenant = await prisma.tenant.findUnique({
        where: { id: pilotTenantId },
      });
    }

    if (!tenant) {
      tenant = await prisma.tenant.findFirst();
    }

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: "شركة كاسبر الرئيسية - التجريبية",
          state: "active",
        },
      });
    }

    const tenantToken = signTenantSession(tenant.id);
    const adminToken = signAdminSession("admin");

    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_session', adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // أسبوع
      path: '/',
    });

    response.cookies.set('tenant_session', tenantToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // أسبوع
      path: '/',
    });

    return response;
  }

  return NextResponse.json({ error: 'باسورد غلط' }, { status: 401 });
}


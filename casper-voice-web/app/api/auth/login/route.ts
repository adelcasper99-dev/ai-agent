import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { signTenantSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
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
          status: "APPROVED",
        },
      });
    }

    const tenantToken = signTenantSession(tenant.id);

    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_session', 'valid', {
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


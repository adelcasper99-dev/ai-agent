import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { signTenantSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (password === process.env.ADMIN_PASSWORD) {
    const pilotTenantId = process.env.PILOT_TENANT_ID;
    if (!pilotTenantId) {
      return NextResponse.json({ error: 'PILOT_TENANT_ID غير معرف في البيئة' }, { status: 500 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: pilotTenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'الشركة المعرفة في PILOT_TENANT_ID غير موجودة' }, { status: 500 });
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

